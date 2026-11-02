import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INSTRUMENT_DEFAULTS, INSTRUMENT_PARAMS } from '../src/instrument-params.ts';

test('every built-in setting has a default inside its range', () => {
  for (const [id, params] of Object.entries(INSTRUMENT_PARAMS)) {
    const defaults = INSTRUMENT_DEFAULTS[id as keyof typeof INSTRUMENT_DEFAULTS] as unknown as Record<string, unknown>;

    for (const param of params) {
      const value = defaults[param.key];

      if (param.kind === 'choice') assert.ok(param.options.some((option) => option.value === value), `${id}.${param.key}`);
      else {
        assert.equal(typeof value, 'number', `${id}.${param.key}`);
        assert.ok((value as number) >= param.min && (value as number) <= param.max, `${id}.${param.key}`);
        if (param.log) assert.ok(param.min > 0, `${id}.${param.key} log scale needs min above 0`);
      }
    }
  }
});
