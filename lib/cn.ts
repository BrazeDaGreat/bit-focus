export function cn(
  ...classNames: (string | string[] | undefined | null)[]
): string {
  return classNames.filter(Boolean).join(" ");
}
