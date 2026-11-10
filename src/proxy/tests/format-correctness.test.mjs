import { test } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// Bug #1: stop_reason 'end_turn' when response has tool calls with STOP
// Google's API returns finishReason: 'STOP' even when functionCalls are present.
// The response converter checks STOP before hasToolCalls, so tool_use responses
// get stop_reason 'end_turn' instead of 'tool_use'.
// ============================================================================

test('Bug #1: convertGoogleToAnthropic returns tool_use stop_reason when functionCalls present with STOP finishReason', async () => {
    const { convertGoogleToAnthropic } = await import('../format/response-converter.js');

    const googleResponse = {
        candidates: [{
            content: {
                parts: [
                    { text: 'Let me read that file.' },
                    {
                        functionCall: {
                            name: 'Read',
                            args: { path: '/foo/bar.js' }
                        }
                    }
                ]
            },
            finishReason: 'STOP'
        }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 }
    };

    const result = convertGoogleToAnthropic(googleResponse, 'gemini-2.5-pro');

    assert.equal(result.stop_reason, 'tool_use',
        `Expected stop_reason 'tool_use' when functionCalls present, got '${result.stop_reason}'`);
});

test('Bug #1: convertGoogleToAnthropic returns end_turn when no tool calls with STOP', async () => {
    const { convertGoogleToAnthropic } = await import('../format/response-converter.js');

    const googleResponse = {
        candidates: [{
            content: {
                parts: [{ text: 'Hello world' }]
            },
            finishReason: 'STOP'
        }],
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 10 }
    };

    const result = convertGoogleToAnthropic(googleResponse, 'gemini-2.5-pro');
    assert.equal(result.stop_reason, 'end_turn');
});

// ============================================================================
// Bug #2: functionResponse.name uses tool_use_id instead of function name
// Google API requires functionResponse.name to match the corresponding
// functionCall.name. Using tool_use_id breaks Gemini tool result matching.
// ============================================================================

test('Bug #2: convertContentToParts sets functionResponse.name to function name, not tool_use_id', async () => {
    const { convertContentToParts } = await import('../format/content-converter.js');

    const content = [
        {
            type: 'tool_result',
            tool_use_id: 'toolu_abc123',
            content: 'File contents here'
        }
    ];

    // Provide a toolUseNameMap that maps the tool_use_id to its function name
    const toolUseNameMap = new Map([['toolu_abc123', 'Read']]);
    const parts = convertContentToParts(content, false, true, toolUseNameMap);

    const functionResponsePart = parts.find(p => p.functionResponse);
    assert.ok(functionResponsePart, 'Should have a functionResponse part');
    assert.equal(functionResponsePart.functionResponse.name, 'Read',
        `Expected functionResponse.name 'Read', got '${functionResponsePart.functionResponse.name}'`);
});

test('Bug #2: convertContentToParts falls back to tool_use_id when no map provided', async () => {
    const { convertContentToParts } = await import('../format/content-converter.js');

    const content = [
        {
            type: 'tool_result',
            tool_use_id: 'toolu_abc123',
            content: 'File contents here'
        }
    ];

    // Without a map, should fall back to tool_use_id (backwards compat)
    const parts = convertContentToParts(content, false, true);
    const functionResponsePart = parts.find(p => p.functionResponse);
    assert.ok(functionResponsePart);
    assert.equal(functionResponsePart.functionResponse.name, 'toolu_abc123');
});

// ============================================================================
// Bug #2b: convertAnthropicToGoogle builds toolUseNameMap from messages
// The request converter must extract tool_use id→name mappings from assistant
// messages and pass them to convertContentToParts for user tool_result messages.
// ============================================================================

test('Bug #2b: convertAnthropicToGoogle resolves functionResponse.name from prior tool_use', async () => {
    const { convertAnthropicToGoogle } = await import('../format/request-converter.js');

    const request = {
        model: 'gemini-2.5-pro',
        messages: [
            { role: 'user', content: 'Read /foo.js' },
            {
                role: 'assistant',
                content: [
                    { type: 'text', text: 'Reading file...' },
                    { type: 'tool_use', id: 'toolu_xyz789', name: 'Read', input: { path: '/foo.js' } }
                ]
            },
            {
                role: 'user',
                content: [
                    { type: 'tool_result', tool_use_id: 'toolu_xyz789', content: 'file contents' }
                ]
            }
        ],
        max_tokens: 1024
    };

    const googleRequest = convertAnthropicToGoogle(request);

    // The last user message should have a functionResponse with name 'Read'
    const lastContent = googleRequest.contents[googleRequest.contents.length - 1];
    const frPart = lastContent.parts.find(p => p.functionResponse);
    assert.ok(frPart, 'Should have functionResponse in converted request');
    assert.equal(frPart.functionResponse.name, 'Read',
        `Expected functionResponse.name 'Read', got '${frPart.functionResponse.name}'`);
});

// ============================================================================
// Bug #4: Whitespace-only text blocks dropped in request conversion
// The content converter drops text blocks where text.trim() is falsy,
// but whitespace-only text blocks are valid and may carry formatting.
// ============================================================================

test('Bug #4: convertContentToParts preserves whitespace-only text blocks', async () => {
    const { convertContentToParts } = await import('../format/content-converter.js');

    const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'World' }
    ];

    const parts = convertContentToParts(content, false, false);
    assert.equal(parts.length, 3,
        `Expected 3 parts (including whitespace), got ${parts.length}`);
    assert.equal(parts[1].text, ' ');
});

test('Bug #4: convertContentToParts still drops truly empty text blocks', async () => {
    const { convertContentToParts } = await import('../format/content-converter.js');

    const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: '' },
        { type: 'text', text: 'World' }
    ];

    const parts = convertContentToParts(content, false, false);
    assert.equal(parts.length, 2, 'Empty string text blocks should still be dropped');
});
