import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { StreamLanguage } from '@codemirror/language';

// Simple syntax highlighting for calc documents
const calcLanguage = StreamLanguage.define({
  startState() {
    return { inSvg: false };
  },
  token(stream, state: { inSvg: boolean }) {
    // SVG block content
    if (state.inSvg) {
      if (stream.match(/^@end\s*$/)) {
        state.inSvg = false;
        return 'keyword';
      }
      // Highlight {{var}} inside SVG
      if (stream.match(/\{\{\w+\}\}/)) {
        return 'variableName';
      }
      stream.next();
      return 'string';
    }

    // Heading
    if (stream.sol() && stream.match(/^#{1,6}\s+/)) {
      stream.skipToEnd();
      return 'heading';
    }

    // SVG start
    if (stream.sol() && stream.match(/^@svg\s*$/)) {
      state.inSvg = true;
      return 'keyword';
    }

    // Select start
    if (stream.sol() && stream.match(/^@select\s+/)) {
      stream.skipToEnd();
      return 'keyword';
    }

    // Image
    if (stream.sol() && stream.match(/^@img\(.+\)\s*$/)) {
      return 'keyword';
    }

    // Conditionals
    if (stream.sol() && stream.match(/^#if\s+/)) {
      stream.skipToEnd();
      return 'keyword';
    }
    if (stream.sol() && stream.match(/^#else\s*$/)) {
      return 'keyword';
    }
    if (stream.sol() && stream.match(/^#end\s+if\s*$/)) {
      return 'keyword';
    }

    // Assignment: highlight variable name
    if (stream.sol() && stream.match(/^[a-zA-Z_]\w*(?=\s*=)/)) {
      return 'variableName.definition';
    }

    // Skip rest of line
    stream.skipToEnd();
    return null;
  },
});

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  onChange: (content: string) => void
): EditorView {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString());
    }
  });

  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      basicSetup,
      oneDark,
      calcLanguage,
      updateListener,
      EditorView.lineWrapping,
    ],
  });

  return new EditorView({ state, parent });
}
