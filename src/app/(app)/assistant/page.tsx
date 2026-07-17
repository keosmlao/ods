import { AssistantChat } from "@/components/assistant/assistant-chat";
import { assistantReady } from "@/lib/ai-assistant-tools";

export default function AssistantPage() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">AI ຜູ້ຊ່ວຍວຽກ</h1>
        <p className="mt-1 text-xs text-slate-500">
          ຖາມສະຖານະວຽກ · stock ERP · SLA — ອ່ານຢ່າງດຽວ
        </p>
      </div>
      {/* ໃຊ້ດ່ານດຽວກັບ route — ບໍ່ດັ່ງນັ້ນໜ້າບອກ "ພ້ອມ" ແຕ່ຖາມແລ້ວລົ້ມ */}
      <AssistantChat configured={assistantReady()} />
    </div>
  );
}
