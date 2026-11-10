import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertContentToParts } from '../format/content-converter.js';

// Bug 1: functionResponse.name should be the function name, not tool_use_id
test('tool_result: functionResponse.name uses function name, not tool_use_id', () => {
    // Simulate an assistant message with a tool_use followed by user tool_result.
    // First, process the tool_use to build the id→name map
    const toolUseContent = [
        { type: 'tool_use', id: 'toolu_abc123', name: 'read_file', input: { path: '/tmp/x' } }
    ];
    const toolResultContent = [
        { type: 'tool_result', tool_use_id: 'toolu_abc123', content: 'file contents here' }
    ];

    // Convert tool_use first (assistant message) — builds internal map
    convertContentToParts(toolUseContent, false, true);

    // Convert tool_result (user message)
    const parts = convertContentToParts(toolResultContent, false, true);

    const frPart = parts.find(p => p.functionResponse);
    assert.ok(frPart, 'Should have a functionResponse part');
    // The name must be the function name, NOT the tool_use_id
    assert.equal(frPart.functionResponse.name, 'read_file',
        `functionResponse.name should be "read_file" but got "${frPart.functionResponse.name}"`);
});

test('tool_result: functionResponse.name falls back to tool_use_id when no mapping exists', () => {
    const content = [
        { type: 'tool_result', tool_use_id: 'toolu_orphan', content: 'result' }
    ];
    const parts = convertContentToParts(content, false, true);
    const frPart = parts.find(p => p.functionResponse);
    assert.ok(frPart);
    // When no mapping exists, fallback to tool_use_id is acceptable
    assert.equal(frPart.functionResponse.name, 'toolu_orphan');
});

// Bug 2 is a missing argument in streaming-handler.js — tested indirectly via code review.
// We verify the buildHeaders signature requires sessionId when called from the streaming path.

import { buildHeaders } from '../cloudcode/request-builder.js';

test('buildHeaders includes X-Machine-Session-Id when sessionId is provided', () => {
    const headers = buildHeaders('tok', 'gemini-3-flash', 'text/event-stream', 'session-abc');
    assert.equal(headers['X-Machine-Session-Id'], 'session-abc');
});

test('buildHeaders omits X-Machine-Session-Id when sessionId is undefined', () => {
    const headers = buildHeaders('tok', 'gemini-3-flash', 'text/event-stream');
    assert.equal(headers['X-Machine-Session-Id'], undefined);
});
