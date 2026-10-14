// JSON Schema for the director's reply, handed to providers that support
// structured output (Ollama `format`, OpenAI-compatible `json_schema`).
// Written for strict mode: every property required, no extra properties.
// Length and count limits are left out (some strict modes reject those
// keywords); schema.ts enforces them and still validates everything.

const text = { type: 'string' };
const bullets = { type: 'array', items: text };
const slideId = { type: 'string' };

function opSchema(op: string, properties: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'object',
    properties: { op: { type: 'string', enum: [op] }, ...properties },
    required: ['op', ...Object.keys(properties)],
    additionalProperties: false,
  };
}

export const DIRECTOR_REPLY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    operations: {
      type: 'array',
      items: {
        anyOf: [
          opSchema('no_change'),
          opSchema('add_slide', { title: text, bullets }),
          opSchema('update_bullets', { slide: slideId, bullets }),
          opSchema('set_title', { slide: slideId, title: text }),
          opSchema('remove_slide', { slide: slideId }),
          opSchema('reorder', { order: { type: 'array', items: slideId } }),
        ],
      },
    },
  },
  required: ['operations'],
  additionalProperties: false,
};
