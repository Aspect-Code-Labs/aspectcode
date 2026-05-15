/**
 * Tests for provider resolution and .env loading.
 */

import * as assert from 'node:assert/strict';
import { parseDotenv, resolveProvider, loadEnvFile, byokKeyPresent } from '../src/providers/index';

describe('parseDotenv', () => {
  it('parses basic key=value pairs', () => {
    const result = parseDotenv('FOO=bar\nBAZ=qux');
    assert.equal(result['FOO'], 'bar');
    assert.equal(result['BAZ'], 'qux');
  });

  it('ignores comments and blank lines', () => {
    const result = parseDotenv('# comment\n\nFOO=bar\n  # another comment');
    assert.equal(Object.keys(result).length, 1);
    assert.equal(result['FOO'], 'bar');
  });

  it('strips surrounding quotes', () => {
    const result = parseDotenv('A="hello"\nB=\'world\'');
    assert.equal(result['A'], 'hello');
    assert.equal(result['B'], 'world');
  });

  it('handles values with equals sign', () => {
    const result = parseDotenv('KEY=abc=def');
    assert.equal(result['KEY'], 'abc=def');
  });

  it('returns empty object for empty content', () => {
    const result = parseDotenv('');
    assert.deepEqual(result, {});
  });

  it('trims whitespace around keys and values', () => {
    const result = parseDotenv('  KEY  =  value  ');
    assert.equal(result['KEY'], 'value');
  });
});

describe('resolveProvider', () => {
  it('resolves OpenAI provider when OPENAI_API_KEY is set', () => {
    const provider = resolveProvider({ OPENAI_API_KEY: 'sk-test-key' });
    assert.equal(provider.name, 'openai');
  });

  it('throws when no API key is found', () => {
    assert.throws(
      () => resolveProvider({}),
      (err: Error) => {
        assert.ok(err.message.includes('No LLM available'));
        assert.ok(err.message.includes('aspectcode login'));
        return true;
      },
    );
  });

  it('respects LLM_PROVIDER override', () => {
    const provider = resolveProvider({
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test',
    });
    assert.equal(provider.name, 'openai');
  });

  it('throws for forced provider with missing key', () => {
    assert.throws(
      () => resolveProvider({ LLM_PROVIDER: 'openai' }),
      (err: Error) => {
        assert.ok(err.message.includes('OPENAI_API_KEY is not defined'));
        return true;
      },
    );
  });

  it('throws for unknown provider name', () => {
    assert.throws(
      () => resolveProvider({ LLM_PROVIDER: 'unknown-llm' }),
      (err: Error) => {
        assert.ok(err.message.includes('Unknown LLM_PROVIDER'));
        return true;
      },
    );
  });

  it('prefers OpenAI when multiple keys are present', () => {
    const provider = resolveProvider({
      OPENAI_API_KEY: 'sk-openai',
      ANTHROPIC_API_KEY: 'sk-ant-test',
    });
    assert.equal(provider.name, 'openai');
  });

  it('resolves Anthropic provider when ANTHROPIC_API_KEY is set', () => {
    const provider = resolveProvider({ ANTHROPIC_API_KEY: 'sk-ant-test' });
    assert.equal(provider.name, 'anthropic');
  });

  it('prefers a personal key over the hosted proxy when logged in', () => {
    const provider = resolveProvider({
      ASPECTCODE_CLI_TOKEN: 'cli-token',
      ANTHROPIC_API_KEY: 'sk-ant-test',
    });
    assert.equal(provider.name, 'anthropic');
  });

  it('prefers ASPECTCODE_LLM_KEY over the hosted proxy when logged in', () => {
    const provider = resolveProvider({
      ASPECTCODE_CLI_TOKEN: 'cli-token',
      ASPECTCODE_LLM_KEY: 'sk-ant-test',
    });
    assert.equal(provider.name, 'anthropic');
  });

  it('uses the hosted proxy when only a CLI token is present', () => {
    const provider = resolveProvider({ ASPECTCODE_CLI_TOKEN: 'cli-token' });
    assert.ok(provider.name.includes('hosted'));
  });

  it('trims surrounding whitespace from ASPECTCODE_LLM_KEY', () => {
    const provider = resolveProvider({ ASPECTCODE_LLM_KEY: '  sk-ant-test\n' });
    assert.equal(provider.name, 'anthropic');
  });

  it('trims surrounding whitespace from standard provider keys', () => {
    const provider = resolveProvider({ OPENAI_API_KEY: '  sk-openai-test  ' });
    assert.equal(provider.name, 'openai');
  });

  it('ignores a whitespace-only key', () => {
    assert.throws(
      () => resolveProvider({ OPENAI_API_KEY: '   ' }),
      (err: Error) => {
        assert.ok(err.message.includes('No LLM available'));
        return true;
      },
    );
  });
});

describe('byokKeyPresent', () => {
  it('true when ASPECTCODE_LLM_KEY is set', () => {
    assert.ok(byokKeyPresent({ ASPECTCODE_LLM_KEY: 'sk-ant-test' }));
  });

  it('true when OPENAI_API_KEY is set', () => {
    assert.ok(byokKeyPresent({ OPENAI_API_KEY: 'sk-test' }));
  });

  it('true when ANTHROPIC_API_KEY is set', () => {
    assert.ok(byokKeyPresent({ ANTHROPIC_API_KEY: 'sk-ant-test' }));
  });

  it('false when only a CLI token is present', () => {
    assert.ok(!byokKeyPresent({ ASPECTCODE_CLI_TOKEN: 'cli-token' }));
  });

  it('false for an empty environment', () => {
    assert.ok(!byokKeyPresent({}));
  });

  it('false for a whitespace-only key', () => {
    assert.ok(!byokKeyPresent({ ANTHROPIC_API_KEY: '   ' }));
  });
});

describe('loadEnvFile', () => {
  it('returns process.env entries when no .env file exists', () => {
    // /nonexistent will not have a .env file
    const env = loadEnvFile('/nonexistent-dir-' + Date.now());
    // Should at least have PATH from process.env
    assert.ok(typeof env === 'object');
  });
});
