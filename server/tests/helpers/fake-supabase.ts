/**
 * Minimal in-memory fake Supabase client suitable for unit-testing the
 * service functions that build PostgREST `.from().select().eq().in().order().
 * limit().maybeSingle()` chains. Only the query shapes actually used by the
 * tested services are supported.
 */

export type Row = Record<string, unknown>;

export type AppliedFilter = { field: string; operator: string; value: unknown };

function matchesLike(rowValue: unknown, pattern: string): boolean {
  if (rowValue === null || rowValue === undefined) {
    return false;
  }
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.');
  return new RegExp(`^${escaped}$`).test(String(rowValue));
}

/** Parses a PostgREST-style `or` expression such as `user_id.eq.X,friend_id.eq.X`. */
function matchesOr(row: Row, expression: string): boolean {
  return expression.split(',').some((clause) => {
    const match = /^([a-z_]+)\.(eq|neq)\.(.*)$/.exec(clause.trim());
    if (!match) {
      return false;
    }
    const [, field, op, rawValue] = match;
    if (op === 'eq') {
      return String(row[field]) === rawValue;
    }
    return String(row[field]) !== rawValue;
  });
}

export class FakeQuery {
  private predicates: Array<(row: Row) => boolean> = [];
  private applied: AppliedFilter[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private singleMode = false;

  /** The most recent `select(...)` argument received. */
  lastSelect: string | null = null;

  constructor(private table: Row[]) {}

  /** Records the requested columns; fake data is pre-shaped. */
  select(columns?: string): FakeQuery {
    this.lastSelect = columns ?? null;
    return this;
  }

  private addFilter(operator: string, field: string, value: unknown, predicate: (row: Row) => boolean): FakeQuery {
    this.applied.push({ field, operator, value });
    this.predicates.push(predicate);
    return this;
  }

  eq(column: string, value: unknown): FakeQuery {
    return this.addFilter('eq', column, value, (row) => row[column] === value);
  }

  neq(column: string, value: unknown): FakeQuery {
    return this.addFilter('neq', column, value, (row) => row[column] !== value);
  }

  gt(column: string, value: unknown): FakeQuery {
    return this.addFilter('gt', column, value, (row) => Number(row[column]) > Number(value));
  }

  gte(column: string, value: unknown): FakeQuery {
    return this.addFilter('gte', column, value, (row) => Number(row[column]) >= Number(value));
  }

  lt(column: string, value: unknown): FakeQuery {
    return this.addFilter('lt', column, value, (row) => Number(row[column]) < Number(value));
  }

  lte(column: string, value: unknown): FakeQuery {
    return this.addFilter('lte', column, value, (row) => Number(row[column]) <= Number(value));
  }

  like(column: string, pattern: string): FakeQuery {
    return this.addFilter('like', column, pattern, (row) => matchesLike(row[column], pattern));
  }

  ilike(column: string, pattern: string): FakeQuery {
    return this.addFilter('ilike', column, pattern, (row) => matchesLike(row[column], pattern));
  }

  in(column: string, values: unknown[]): FakeQuery {
    return this.addFilter('in', column, values, (row) => values.includes(row[column]));
  }

  is(column: string, value: unknown): FakeQuery {
    return this.addFilter('is', column, value, (row) =>
      value === null ? row[column] === null || row[column] === undefined : row[column] === value,
    );
  }

  or(expression: string): FakeQuery {
    return this.addFilter('or', 'or', expression, (row) => matchesOr(row, expression));
  }

  order(column: string, options?: { ascending?: boolean }): FakeQuery {
    this.orderCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(n: number): FakeQuery {
    this.limitN = n;
    return this;
  }

  /** The most recent `limit(...)` argument, or null. */
  get appliedLimit(): number | null {
    return this.limitN;
  }

  maybeSingle(): FakeQuery {
    this.singleMode = true;
    return this;
  }

  single(): FakeQuery {
    this.singleMode = true;
    return this;
  }

  range(): FakeQuery {
    return this;
  }

  /** Filters that were applied through the PostgREST-style chain. */
  filters(): AppliedFilter[] {
    return this.applied;
  }

  private compute(): { data: Row[] | Row | null; error: null; count: number } {
    let rows = this.table.filter((row) => this.predicates.every((p) => p(row)));
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => {
        const av = String(a[col] ?? '');
        const bv = String(b[col] ?? '');
        return this.orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (this.limitN && this.limitN > 0) {
      rows = rows.slice(0, this.limitN);
    }
    return { data: this.singleMode ? (rows[0] ?? null) : rows, error: null, count: rows.length };
  }

  then(resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) {
    return Promise.resolve(this.compute()).then(resolve, reject);
  }
}

export function createFakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string): FakeQuery {
      return new FakeQuery(tables[table] ?? []);
    },
  };
}