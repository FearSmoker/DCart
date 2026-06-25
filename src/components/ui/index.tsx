const Table = ({ children }: React.PropsWithChildren) => (
  <div className="w-full overflow-auto">
    <table className="w-full caption-bottom text-sm">{children}</table>
  </div>
);
export const TableHeader = ({ children }: React.PropsWithChildren) => (
  <thead>{children}</thead>
);

export const TableBody = ({ children }: React.PropsWithChildren) => (
  <tbody>{children}</tbody>
);

export const TableRow = ({ children }: React.PropsWithChildren) => (
  <tr className="border-b dark:border-zinc-800 transition-colors hover:bg-muted/50 dark:hover:bg-zinc-800/50 data-[state=selected]:bg-muted dark:data-[state=selected]:bg-zinc-850">
    {children}
  </tr>
);

export const TableHead = ({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) => (
  <th
    className={`h-12 px-4 text-left align-middle font-medium text-muted-foreground dark:text-zinc-400 [&:has([role=checkbox])]:pr-0 ${className}`}
  >
    {children}
  </th>
);

export const TableCell = ({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) => (
  <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}>
    {children}
  </td>
);

// Card components defined inline
export const Card = ({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) => (
  <div
    className={`rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-card-foreground dark:text-zinc-200 shadow-sm ${className}`}
  >
    {children}
  </div>
);

export const CardHeader = ({ children }: React.PropsWithChildren) => (
  <div className="flex flex-col space-y-1.5 p-6">{children}</div>
);

export const CardTitle = ({ children }: React.PropsWithChildren) => (
  <h3 className="text-xl font-bold leading-none tracking-tight text-accent dark:text-zinc-150">
    {children}
  </h3>
);

export const CardContent = ({ children }: React.PropsWithChildren) => (
  <div className="p-6 pt-0">{children}</div>
);

// badge component defined inline
export const Badge = ({
  children,
  variant = "default",
}: React.PropsWithChildren<{
  variant?: "default" | "success" | "destructive";
}>) => {
  const variantClasses = {
    default: "bg-primary dark:bg-zinc-800 text-primary-foreground dark:text-zinc-200 hover:bg-primary/80 dark:hover:bg-zinc-700",
    success: "bg-green-500 text-white dark:bg-emerald-600/20 dark:text-emerald-400 dark:border dark:border-emerald-800/30",
    destructive: "bg-red-500 text-white dark:bg-red-950/30 dark:text-red-400 dark:border dark:border-red-900/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
};

export const Button = ({
  children,
  onClick,
  variant = "default",
  className = "",
  disabled = false,
}: React.PropsWithChildren<{
  onClick?: () => void;
  variant?: "default" | "delete" | "custom";
  className?: string;
  disabled?: boolean;
}>) => {
  const baseClasses =
    "h-10 py-2 w-40 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex items-center gap-1 justify-center duration-300";

  const variantClasses = {
    default: "bg-black dark:bg-zinc-100 text-white dark:text-black hover:bg-black/80 dark:hover:bg-zinc-200",
    delete: "bg-red-600 dark:bg-red-750 text-white hover:bg-red-700 dark:hover:bg-red-655",
    custom: "",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};
export default Table;
