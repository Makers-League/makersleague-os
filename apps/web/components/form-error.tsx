export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" data-testid="form-error" className="text-sm text-destructive">
      {message}
    </p>
  );
}
