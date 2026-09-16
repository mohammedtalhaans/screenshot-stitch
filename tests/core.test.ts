import { it } from 'vitest';
import { cases } from './core-cases';
for (const testCase of cases)
    it(testCase.name, testCase.run);
