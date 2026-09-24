"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n/client"
import { cn } from "@/lib/utils"

/** Password box with a show/hide eye, so people can check what they typed on a phone. */
export function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  const { t } = useT()
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={cn("pr-11", className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t("Hide password") : t("Show password")}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  )
}
