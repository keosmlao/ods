"use client";

import { Button, ErrorBox, LinkButton } from "@/components/ui";
import { LoaderCircle, LogOut, Save } from "lucide-react";
import { useFormStatus } from "react-dom";

/**
 * ປຸ່ມ "ບັນທືກ / ອອກ" ຄືກັບຫົວຂອງທຸກໜ້າຟອມໃນ ods.
 * ບາງໜ້າ (ຂໍສົ່ງຄືນ) ປຸ່ມ "ອອກ" ຕ້ອງລຶບແຖວຮ່າງກ່ອນ → ສົ່ງ exitAction ມາແທນ backHref.
 */
export function SaveBar({
  backHref,
  exitAction,
  disabled,
}: {
  backHref?: string;
  exitAction?: () => Promise<void>;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" tone="success" disabled={pending || disabled}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        &nbsp;ບັນທືກ
      </Button>

      {exitAction ? (
        <Button type="submit" tone="neutral" formAction={exitAction} formNoValidate disabled={pending}>
          <LogOut className="size-4" />
          &nbsp;ອອກ
        </Button>
      ) : (
        <LinkButton href={backHref ?? "/"} tone="neutral">
          <LogOut className="size-4" />
          &nbsp;ອອກ
        </LinkButton>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  return message ? <ErrorBox>{message}</ErrorBox> : null;
}
