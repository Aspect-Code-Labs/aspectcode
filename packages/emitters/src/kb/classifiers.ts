/**
 * File classifiers — re-exported from @aspectcode/core.
 *
 * The canonical implementations now live in core so the CLI can use them
 * without depending on the emitters package for this purpose.
 */
export {
  classifyFile,
  isStructuralAppFile,
  isConfigOrToolingFile,
  type FileKind,
} from '@aspectcode/core';
