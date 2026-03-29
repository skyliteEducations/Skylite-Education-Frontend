declare module 'react-katex' {
    import * as React from 'react';
    interface MathProps {
        math: string;
        block?: boolean;
        errorColor?: string;
        renderError?: (error: Error | string) => React.ReactNode;
    }
    export class InlineMath extends React.Component<MathProps> {}
    export class BlockMath extends React.Component<MathProps> {}
}

declare module 'katex/dist/contrib/auto-render' {
    export default function renderMathInElement(elem: HTMLElement, options?: any): void;
}
