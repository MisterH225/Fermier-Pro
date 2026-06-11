type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, action }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between mb-2">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
