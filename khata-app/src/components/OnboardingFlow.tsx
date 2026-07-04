import { useState } from "react";

interface OnboardingFlowProps {
  onComplete: (phone: string) => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className="flex h-full flex-col bg-white p-4">
      {step === 1 ? (
        <>
          <h1 className="text-[15px] font-semibold text-gray-800">Mobile Khata</h1>
          <p className="mt-2 text-[12px] text-gray-600">
            Tapai ko phone number halnuhos. Yo device ma matra identify garna ho.
          </p>
          <label className="mt-4 text-[11px] font-medium text-gray-600">Phone number</label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="98XXXXXXXX"
            className="mt-1 h-8 w-full rounded-md border border-gray-300 px-2.5 text-[12px]"
          />
          <button
            type="button"
            disabled={phone.length < 10}
            onClick={() => setStep(2)}
            className="mt-4 h-8 rounded-md bg-[#1557b0] text-[12px] font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        </>
      ) : (
        <>
          <h2 className="text-[15px] font-semibold text-gray-800">Privacy</h2>
          <p className="mt-3 text-[12px] text-gray-700">
            यो app तपाईंको निजी हिसाबकिताबको लागि हो। यहाँ राखिएको जानकारी कर विभाग वा कुनै
            सरकारी निकायलाई पठाइदैन।
          </p>
          <p className="mt-3 text-[12px] text-gray-700">
            Mobile Khata is your private record book. Your data is never reported to the tax office
            or any government body.
          </p>
          <button
            type="button"
            onClick={() => onComplete(phone)}
            className="mt-6 h-8 rounded-md bg-[#1557b0] text-[12px] font-medium text-white"
          >
            Start using Khata
          </button>
        </>
      )}
    </div>
  );
}
