/**
 * 本地数据库 — 基于 localStorage 的持久化存储
 *
 * 比 SQLite 插件更可靠：无需原生依赖，所有 Android 设备通用。
 * 存储上限 ~5MB，任务数据绰绰有余。
 */

const DB_PREFIX = "lup_";

function tableKey(name: string): string {
  return DB_PREFIX + name;
}

function loadTable(name: string): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(tableKey(name));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTable(name: string, rows: Record<string, unknown>[]): void {
  try {
    localStorage.setItem(tableKey(name), JSON.stringify(rows));
  } catch {
    // 存储满了，忽略
  }
}

function normalizeComparable(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const text = String(value);
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function parseWhereValue(raw: string, params: unknown[], index: { value: number }): unknown {
  const value = raw.trim();
  if (value === "?") return params[index.value++];
  if (/^NULL$/i.test(value)) return null;
  const quoted = value.match(/^['"]([^'"]*)['"]$/);
  if (quoted) return quoted[1];
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function matchesCondition(row: Record<string, unknown>, condition: string, expected: unknown): boolean {
  const match = condition.trim().match(/^(\w+)\s*(=|!=|<>|<=|>=|<|>)\s*(.+)$/);
  if (!match) return false;
  const [, column, operator] = match;
  const left = normalizeComparable(row[column]);
  const right = normalizeComparable(expected);

  if (operator === "=") return left === right || String(left) === String(right);
  if (operator === "!=" || operator === "<>") return !(left === right || String(left) === String(right));
  if (left === null || right === null) return false;

  if (operator === "<") return left < right;
  if (operator === ">") return left > right;
  if (operator === "<=") return left <= right;
  if (operator === ">=") return left >= right;
  return false;
}

function matchesWhere(row: Record<string, unknown>, whereClause: string, params: unknown[]): boolean {
  const index = { value: 0 };
  const conditions = whereClause.split(/\s+AND\s+/i);
  return conditions.every((condition) => {
    const valuePart = condition.match(/^(\w+)\s*(=|!=|<>|<=|>=|<|>)\s*(.+)$/)?.[3];
    if (valuePart === undefined) return false;
    return matchesCondition(row, condition, parseWhereValue(valuePart, params, index));
  });
}

/** 查询所有行 */
export async function queryAll<T = Record<string, unknown>>(sql: string, _params?: unknown[]): Promise<T[]> {
  const table = sql.match(/FROM\s+(\w+)/i)?.[1];
  if (!table) return [];
  let rows = loadTable(table);

  // WHERE 过滤
  const whereClause = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i)?.[1];
  if (whereClause) {
    rows = rows.filter((row) => matchesWhere(row, whereClause, _params ?? []));
  }

  // ORDER BY
  const orderMatch = sql.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
  if (orderMatch) {
    const col = orderMatch[1];
    const dir = orderMatch[2]?.toUpperCase() === "DESC" ? -1 : 1;
    rows.sort((a, b) => {
      const av = a[col], bv = b[col];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  // LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    rows = rows.slice(0, parseInt(limitMatch[1]));
  }

  if (sql.toLowerCase().includes("count(")) {
    return [{ count: rows.length } as unknown as T];
  }
  return rows as T[];
}

/** 查询单行 */
export async function queryOne<T = Record<string, unknown>>(sql: string, _params: unknown[] = []): Promise<T | null> {
  const table = sql.match(/FROM\s+(\w+)/i)?.[1];
  if (!table) return null;

  // 提取 WHERE id = ?
  const idMatch = sql.match(/\bid\s*=\s*\?/i);
  const rows = loadTable(table);

  // task_id match for habit_log
  const tidMatch = sql.match(/\btask_id\s*=\s*\?/i);
  if (tidMatch) {
    const tid = _params[0];
    const filtered = rows.filter((r) => r["task_id"] === tid || String(r["task_id"]) === String(tid));
    if (/\bcompleted_at\s*=\s*\?/i.test(sql)) {
      const date = _params[1];
      return (filtered.find((r) => r["completed_at"] === date || String(r["completed_at"]) === String(date)) as T) || null;
    }
    return (filtered[0] as T) || null;
  }

  if (idMatch) {
    const idVal = _params[0];
    return (rows.find((r) => r.id === idVal || String(r.id) === String(idVal)) as T) || null;
  }

  // item_key match for inventory
  const ikMatch = sql.match(/\bitem_key\s*=\s*\?/i);
  if (ikMatch) {
    const ik = _params[0];
    return (rows.find((r) => r["item_key"] === ik) as T) || null;
  }

  // key match for achievement
  const keyMatch = sql.match(/\bkey\s*=\s*\?/i);
  if (keyMatch) {
    const k = _params[0];
    return (rows.find((r) => r["key"] === k) as T) || null;
  }

  return rows.length > 0 ? (rows[0] as T) : null;
}

/** 执行写操作 */
export async function execute(sql: string, _params: unknown[] = []): Promise<void> {
  const upper = sql.trim().toUpperCase();

  // DELETE
  if (upper.startsWith("DELETE")) {
    const table = sql.match(/FROM\s+(\w+)/i)?.[1];
    if (!table) return;
    let rows = loadTable(table);
    if (upper.includes("WHERE")) {
      if (upper.includes("TASK_ID")) {
        rows = rows.filter((r) => {
          const taskMatches = r["task_id"] === _params[0];
          const dateMatches = _params.length <= 1 || r["completed_at"] === _params[1];
          return !(taskMatches && dateMatches);
        });
      } else if (upper.includes("ID")) {
        rows = rows.filter((r) => r.id !== _params[0]);
      }
    } else {
      rows = [];
    }
    saveTable(table, rows);
    return;
  }

  // UPDATE
  if (upper.startsWith("UPDATE")) {
    const table = sql.match(/UPDATE\s+(\w+)/i)?.[1];
    if (!table) return;
    const rows = loadTable(table);

    const setMatch = sql.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
    const setParts = setMatch?.[1].split(",").map((s) => s.trim()) || [];
    const setParamCount = setParts.reduce((count, part) => {
      return count + (part.includes("?") ? 1 : 0);
    }, 0);

    const hasWhere = /\bWHERE\b/i.test(sql);
    const whereClause = sql.match(/\bWHERE\s+(.+)$/i)?.[1]?.trim() ?? "";
    const targets: Record<string, unknown>[] = [];

    if (!hasWhere) {
      targets.push(...rows);
    } else {
      targets.push(...rows.filter((row) => matchesWhere(row, whereClause, _params.slice(setParamCount))));
    }

    for (const target of targets) {
      let paramIdx = 0;
      for (const part of setParts) {
        const arithmetic = part.match(/^(\w+)\s*=\s*(\w+)\s*([+-])\s*\?$/);
        if (arithmetic) {
          const [, col, sourceCol, op] = arithmetic;
          const base = Number(target[sourceCol] ?? 0);
          const delta = Number(_params[paramIdx++] ?? 0);
          target[col] = op === "+" ? base + delta : base - delta;
          continue;
        }

        const literalArithmetic = part.match(/^(\w+)\s*=\s*(\w+)\s*([+-])\s*(-?\d+)$/);
        if (literalArithmetic) {
          const [, col, sourceCol, op, rawDelta] = literalArithmetic;
          const base = Number(target[sourceCol] ?? 0);
          const delta = Number(rawDelta);
          target[col] = op === "+" ? base + delta : base - delta;
          continue;
        }

        const placeholder = part.match(/^(\w+)\s*=\s*\?$/);
        if (placeholder) {
          target[placeholder[1]] = _params[paramIdx++];
          continue;
        }

        const nullValue = part.match(/^(\w+)\s*=\s*NULL$/i);
        if (nullValue) {
          target[nullValue[1]] = null;
          continue;
        }

        const literalString = part.match(/^(\w+)\s*=\s*['"]([^'"]*)['"]$/);
        if (literalString) {
          target[literalString[1]] = literalString[2];
          continue;
        }

        const literalNumber = part.match(/^(\w+)\s*=\s*(-?\d+)$/);
        if (literalNumber) {
          target[literalNumber[1]] = Number(literalNumber[2]);
        }
      }
    }

    saveTable(table, rows);
    return;
  }

  // INSERT
  if (upper.startsWith("INSERT")) {
    const table = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i)?.[1];
    if (!table) return;
    const rows = loadTable(table);
    const cols = sql.match(/\(([^)]+)\)/g)?.[0]?.replace(/[()]/g, "").split(",").map((c) => c.trim()) || [];

    // Parse VALUES clause: handle both ? placeholders and literal values
    const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
    const valTokens = valuesMatch?.[1].split(",").map((v) => v.trim()) || [];

    const newRow: Record<string, unknown> = {};
    let paramIdx = 0;
    for (let i = 0; i < cols.length; i++) {
      const token = valTokens[i];
      if (token === "?") {
        newRow[cols[i]] = _params[paramIdx++] ?? null;
      } else if (token.toUpperCase() === "NULL") {
        newRow[cols[i]] = null;
      } else {
        // Attempt to parse as number
        const num = Number(token);
        newRow[cols[i]] = isNaN(num) ? token.replace(/^['"]|['"]$/g, "") : num;
      }
    }
    if (newRow.id === undefined) {
      const maxId = rows.reduce((max, r) => Math.max(max, (r.id as number) || 0), 0);
      newRow.id = maxId + 1;
    }
    rows.push(newRow);
    saveTable(table, rows);
    return;
  }
}

/** 插入并返回新 ID */
export async function insert(sql: string, params: unknown[] = []): Promise<number> {
  await execute(sql, params);
  // Parse table name and return next ID
  const table = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i)?.[1];
  if (!table) return 0;
  const rows = loadTable(table);
  return rows.length > 0 ? (rows[rows.length - 1].id as number) : 1;
}

// Re-export for compatibility
export { loadTable, saveTable };
