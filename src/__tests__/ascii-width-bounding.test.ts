import { describe, expect, it } from 'bun:test'
import { renderMermaidASCII } from '../ascii/index.ts'

const WIDTHS = [
  { name: 'unbounded', value: undefined },
  { name: '120', value: 120 },
  { name: '100', value: 100 },
  { name: '80', value: 80 },
  { name: '60', value: 60 },
  { name: '40', value: 40 },
] as const

const LONG_TOKEN = `LONGTOKEN${'X'.repeat(140)}`
const LONG_ENTITY = `ENTITY${'X'.repeat(140)}`
const LONG_TITLE = `TITLE${'X'.repeat(140)}`

function renderPlain(diagram: string, maxWidth?: number): string {
  return renderMermaidASCII(diagram, {
    useAscii: false,
    colorMode: 'none',
    maxWidth,
  })
}

function maxLineWidth(output: string): number {
  return Math.max(...output.split('\n').map(line => line.length), 0)
}

function squashedContent(output: string): string {
  return output.replace(/[^A-Za-z0-9_]+/g, '')
}

function containsOrderedSubsequence(haystack: string, needle: string): boolean {
  let idx = 0
  for (const ch of haystack) {
    if (ch === needle[idx]) idx++
    if (idx === needle.length) return true
  }
  return needle.length === 0
}

function expectContent(output: string, labels: readonly string[]): void {
  const squashed = squashedContent(output)
  for (const label of labels) {
    for (const token of label.split(/\s+/).filter(Boolean)) {
      expect(containsOrderedSubsequence(squashed, squashedContent(token))).toBe(true)
    }
  }
}

function expectWidth(output: string, maxWidth: number): void {
  for (const line of output.split('\n')) {
    expect(line.length).toBeLessThanOrEqual(maxWidth)
  }
}

function expectUniformLineWidth(output: string): void {
  const widths = output.split('\n').map(line => line.length)
  expect(new Set(widths).size).toBe(1)
}

const diagrams = [
  {
    name: 'flowchart',
    diagram: `graph TD
      A[${LONG_TOKEN}]`,
    labels: [LONG_TOKEN],
  },
  {
    name: 'state diagram',
    diagram: `stateDiagram-v2
      state "${LONG_TOKEN}" as WideState
      [*] --> WideState`,
    labels: [LONG_TOKEN],
  },
  {
    name: 'sequence diagram',
    diagram: `sequenceDiagram
      participant L as ${LONG_TOKEN}
      L->>L: pingToken`,
    labels: [LONG_TOKEN, 'pingToken'],
  },
  {
    name: 'class diagram',
    diagram: `classDiagram
      class ${LONG_TOKEN}`,
    labels: [LONG_TOKEN],
  },
  {
    name: 'ER diagram',
    diagram: `erDiagram
      ${LONG_ENTITY} {
        string entityToken
      }`,
    labels: [LONG_ENTITY, 'entityToken'],
  },
  {
    name: 'xychart',
    diagram: `xychart-beta
      title "${LONG_TITLE}"
      x-axis [Q1]
      bar [120]`,
    labels: [LONG_TITLE, 'Q1'],
  },
] as const

describe('ASCII width bounding', () => {
  it('keeps the reported LR flowchart sample within visible width in API output', () => {
    const diagram = `graph LR
      A[Alpha Service] --> B[Beta Service] --> C[Gamma Service] --> D[REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG]`
    const output = renderMermaidASCII(diagram, {
      useAscii: false,
      colorMode: 'none',
      maxWidth: 60,
    })

    expectContent(output, ['Alpha Service', 'Beta Service', 'Gamma Service', 'REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG'])
    expectWidth(output, 60)
  })

  it('does not unnecessarily shrink the reported LR flowchart sample once a bounded layout width is reached', () => {
    const diagram = `graph LR
      A[Alpha Service] --> B[Beta Service] --> C[Gamma Service] --> D[REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG]`
    const at80 = renderMermaidASCII(diagram, {
      useAscii: true,
      colorMode: 'none',
      maxWidth: 80,
    })
    const at70 = renderMermaidASCII(diagram, {
      useAscii: true,
      colorMode: 'none',
      maxWidth: 70,
    })

    expectContent(at80, ['Alpha Service', 'Beta Service', 'Gamma Service', 'REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG'])
    expectContent(at70, ['Alpha Service', 'Beta Service', 'Gamma Service', 'REAALLLLLY LOOOOOOOOOOOOOOOOOOOOOOOOONG'])
    expectWidth(at80, 80)
    expectUniformLineWidth(at80)
    expect(maxLineWidth(at80)).toBeGreaterThan(0)

    const fixedPointWidth = maxLineWidth(at80)
    const atFixedPoint = renderMermaidASCII(diagram, {
      useAscii: true,
      colorMode: 'none',
      maxWidth: fixedPointWidth,
    })

    expectWidth(atFixedPoint, fixedPointWidth)
    expectUniformLineWidth(atFixedPoint)
    expect(atFixedPoint).toBe(at80)
  })

  for (const diagramCase of diagrams) {
    describe(diagramCase.name, () => {
      it('has an unconstrained render wider than 120 columns', () => {
        const baseline = renderPlain(diagramCase.diagram)

        expectContent(baseline, diagramCase.labels)
        expect(maxLineWidth(baseline)).toBeGreaterThan(120)
      })

      for (const widthCase of WIDTHS) {
        it(`preserves content and ${widthCase.name === 'unbounded' ? 'matches default width behavior' : `keeps every line within ${widthCase.name}`}`, () => {
          const output = renderPlain(diagramCase.diagram, widthCase.value)

          expectContent(output, diagramCase.labels)

          if (widthCase.value === undefined) {
            const baseline = renderPlain(diagramCase.diagram)
            expect(output).toBe(baseline)
            expect(maxLineWidth(output)).toBe(maxLineWidth(baseline))
            expect(maxLineWidth(output)).toBeGreaterThan(0)
            return
          }

          expectWidth(output, widthCase.value)

          const fixedPointWidth = maxLineWidth(output)
          expect(fixedPointWidth).toBeGreaterThan(0)

          const rerendered = renderPlain(diagramCase.diagram, fixedPointWidth)
          expectContent(rerendered, diagramCase.labels)
          expectWidth(rerendered, fixedPointWidth)
          expect(rerendered).toBe(output)
        })
      }
    })
  }
})
