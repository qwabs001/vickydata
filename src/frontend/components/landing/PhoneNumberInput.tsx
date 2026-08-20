import { formatGhanaPhone } from "@/shared/utils/formatters";

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

export function PhoneNumberInput({
  value,
  onChange,
  error
}: PhoneNumberInputProps) {
  return (
    <section>
      <label className="mb-3 hidden text-sm font-bold text-gray-600 dark:text-gray-400 md:block">
        Ghanaian Phone Number
      </label>
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-4 flex items-center gap-2 border-r border-gray-200 pr-3 dark:border-gray-600">
          <div
            className="h-4 w-6 bg-contain bg-no-repeat"
            style={{
              backgroundImage: "url('/images/networks/ghana-flag.png')"
            }}
          />
          <span className="font-bold text-gray-700 dark:text-gray-300">+233</span>
        </div>
        <input
          value={value}
          placeholder="0240 000 000"
          onChange={(event) => onChange(formatGhanaPhone(event.target.value))}
          className={`w-full rounded-xl border-gray-200 bg-white py-3 pl-28 pr-4 text-sm font-medium tracking-widest outline outline-1 outline-slate-200/70 outline-offset-2 focus:border-primary focus:ring-primary dark:border-gray-700 dark:bg-gray-900 md:py-4 md:text-lg ${
            error ? "border-red-400" : "border-gray-200"
          }`}
          type="tel"
        />
      </div>
      <p className="mt-2 hidden text-xs text-gray-400 md:block">
        Data will be sent immediately to this number.
      </p>
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </section>
  );
}
