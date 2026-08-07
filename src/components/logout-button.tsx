"use client";

import { useFormStatus } from "react-dom";

export function LogoutButton({
  className,
}: Readonly<{ className?: string }>) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
    >
      {pending ? "Saindo..." : "Sair"}
    </button>
  );
}
