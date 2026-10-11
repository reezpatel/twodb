import { AddressInput } from "@/components/address-input/address-input";
import type { EmailAddress } from "../email-api";

export { parseAddresses } from "@/components/address-input/address-input";

/** To/Cc/Bcc chips; suggestions come from the From account's contact book only. */
export function RecipientInput({
  id,
  value,
  onChange,
  placeholder,
  accountId,
}: {
  id: string;
  value: EmailAddress[];
  onChange: (v: EmailAddress[]) => void;
  placeholder?: string;
  accountId: string;
}) {
  return <AddressInput id={id} value={value} onChange={onChange} placeholder={placeholder} scope={{ accountId }} />;
}
