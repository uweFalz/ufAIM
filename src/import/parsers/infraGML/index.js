// .../parser/IFC/index.js

export const meta = { id: '...' };

export const sniff = {
  extensions: ['...'],
  looksLike: async ({ file, text, bytes }) => false
};

export async function parse({ file, text, bytes, context = {} }) {
  return {};
}
