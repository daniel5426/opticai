import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  const components: Partial<Components> = {
    // @ts-expect-error
    code: ({ node, inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        // @ts-expect-error
        <pre
          {...props}
          className={`${className} text-sm w-[80dvw] md:max-w-[500px] overflow-x-scroll bg-zinc-100 p-3 rounded-lg mt-2 dark:bg-zinc-800`}
          dir="ltr"
        >
          <code className={match[1]}>{children}</code>
        </pre>
      ) : (
        <code
          className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
          {...props}
        >
          {children}
        </code>
      );
    },
    ol: ({ node, children, ...props }) => {
      return (
        <ol className="list-decimal mr-4 ml-4 md:ml-0 space-y-1" {...props} dir="rtl">
          {children}
        </ol>
      );
    },
    li: ({ node, children, ...props }) => {
      return (
        <li className="py-0.5" {...props}>
          {children}
        </li>
      );
    },
    ul: ({ node, children, ...props }) => {
      return (
        <ul className="list-disc mr-4 ml-4 md:ml-0 space-y-1" {...props} dir="rtl">
          {children}
        </ul>
      );
    },
    strong: ({ node, children, ...props }) => {
      return (
        <span className="font-semibold" {...props}>
          {children}
        </span>
      );
    },
    a: ({ node, children, ...props }) => {
      return (
        <a
          className="text-blue-500 hover:underline"
          target="_blank"
          rel="noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    h1: ({ node, children, ...props }) => {
      return (
        <h1 className="text-2xl font-bold mt-4 mb-3 text-foreground" {...props} dir="rtl">
          {children}
        </h1>
      );
    },
    h2: ({ node, children, ...props }) => {
      return (
        <h2 className="text-xl font-bold mt-4 mb-2 text-foreground" {...props} dir="rtl">
          {children}
        </h2>
      );
    },
    h3: ({ node, children, ...props }) => {
      return (
        <h3 className="text-lg font-semibold mt-3 mb-2 text-foreground" {...props} dir="rtl">
          {children}
        </h3>
      );
    },
    h4: ({ node, children, ...props }) => {
      return (
        <h4 className="text-base font-semibold mt-3 mb-1 text-foreground" {...props} dir="rtl">
          {children}
        </h4>
      );
    },
    h5: ({ node, children, ...props }) => {
      return (
        <h5 className="text-sm font-semibold mt-2 mb-1 text-foreground" {...props} dir="rtl">
          {children}
        </h5>
      );
    },
    h6: ({ node, children, ...props }) => {
      return (
        <h6 className="text-sm font-medium mt-2 mb-1 text-foreground" {...props} dir="rtl">
          {children}
        </h6>
      );
    },
    p: ({ node, children, ...props }) => {
      return (
        <p className="mb-2 leading-relaxed" {...props} dir="rtl">
          {children}
        </p>
      );
    },
    blockquote: ({ node, children, ...props }) => {
      return (
        <blockquote className="border-r-4 border-gray-300 pr-4 mr-4 italic text-gray-600 dark:text-gray-400 my-2" {...props} dir="rtl">
          {children}
        </blockquote>
      );
    },
  };

  return (
    <div dir="rtl" className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
