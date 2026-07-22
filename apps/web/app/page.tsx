import { ClassifyPanel } from "@/components/run/classify-panel";
import { ServiceStatus } from "@/components/run/service-status";
import { PanelBody } from "@/components/shell/app-shell";

export default function Page() {
  return (
    <PanelBody className="space-y-5">
      <ServiceStatus />
      <ClassifyPanel />
    </PanelBody>
  );
}
