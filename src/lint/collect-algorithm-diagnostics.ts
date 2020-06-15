import type { Node as EcmarkdownNode, Observer } from 'ecmarkdown';

import type { LintingError } from './algorithm-error-reporter-type';

import { parseAlgorithm, visit } from 'ecmarkdown';

import { getLocation } from './utils';
import lintAlgorithmLineEndings from './rules/algorithm-line-endings';
import lintAlgorithmStepNumbering from './rules/algorithm-step-numbering';

let algorithmRules = [lintAlgorithmLineEndings, lintAlgorithmStepNumbering];

function composeObservers(...observers: Observer[]): Observer {
  return {
    enter(node: EcmarkdownNode) {
      for (let observer of observers) {
        observer.enter?.(node);
      }
    },
    exit(node: EcmarkdownNode) {
      for (let observer of observers) {
        observer.exit?.(node);
      }
    },
  };
}

export function collectAlgorithmDiagnostics(
  dom: any,
  sourceText: string,
  algorithms: { element: Element; tree?: EcmarkdownNode }[]
) {
  let lintingErrors: LintingError[] = [];

  for (let algorithm of algorithms) {
    let element = algorithm.element;
    let location = getLocation(dom, element);

    let reporter = ({ line, column, ...others }: LintingError) => {
      // jsdom's lines and columns are both 1-based
      // ecmarkdown has 1-based line numbers and 0-based column numbers
      // we want 1-based for both
      let trueLine = location.startTag.line + line - 1;
      let trueCol = column;
      if (line === 1) {
        trueCol +=
          location.startTag.col + (location.startTag.endOffset - location.startTag.startOffset);
      } else {
        trueCol += 1;
      }
      lintingErrors.push({ line: trueLine, column: trueCol, ...others });
    };

    let algorithmSource = sourceText.slice(
      location.startTag.endOffset,
      location.endTag.startOffset
    );
    let observer = composeObservers(
      ...algorithmRules.map(f => f(reporter, element, algorithmSource))
    );
    let tree = parseAlgorithm(algorithmSource, { trackPositions: true });
    visit(tree, observer);
    algorithm.tree = tree;
  }

  return lintingErrors;
}
