import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FinalSubjectiveExam } from "@/lib/db/schema"
import { ChevronUp, ChevronDown } from "lucide-react"

interface VHCalculatorProps {
  onConfirm: (rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string, leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string) => void;
  disabled?: boolean;
}

function VHCalculatorModal({ onConfirm, disabled = false }: VHCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rightPrisH, setRightPrisH] = useState<number>(0);
  const [rightBaseH, setRightBaseH] = useState<string>("");
  const [rightPrisV, setRightPrisV] = useState<number>(0);
  const [rightBaseV, setRightBaseV] = useState<string>("");
  const [leftPrisH, setLeftPrisH] = useState<number>(0);
  const [leftBaseH, setLeftBaseH] = useState<string>("");
  const [leftPrisV, setLeftPrisV] = useState<number>(0);
  const [leftBaseV, setLeftBaseV] = useState<string>("");

  const baseHOptions = ["IN", "OUT"];
  const baseVOptions = ["UP", "DOWN"];

  const handleConfirm = () => {
    onConfirm(rightPrisH, rightBaseH, rightPrisV, rightBaseV, leftPrisH, leftBaseH, leftPrisV, leftBaseV);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={`h-8 text-xs px-2 ${disabled ? 'bg-accent/50' : 'bg-white'}`} type="button" disabled={disabled}>
          V + H
        </Button>
      </DialogTrigger>
      <DialogContent className="!w-[880px] !max-w-[1200px]" dir="rtl" showCloseButton={false}>
        <DialogHeader dir="rtl" className="text-center pb-4">
          <DialogTitle className="text-center text-2xl">חישוב פריזמה סופי</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 w-full" dir="rtl">
          <div className="flex items-center gap-4 w-full min-w-fit" dir="ltr">
            <span className="text-lg font-medium w-8 text-center flex-shrink-0"></span>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">PRIS.H</Label>
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">BASE.H</Label>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">PRIS.V</Label>
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">BASE.V</Label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full min-w-fit" dir="ltr">
            <span className="text-lg font-medium w-8 text-center flex-shrink-0">R</span>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="w-24 flex-shrink-0">
                <Input 
                  type="number" 
                  step="0.5" 
                  value={rightPrisH || ""} 
                  onChange={(e) => setRightPrisH(Number(e.target.value))} 
                  className="h-9 pr-1 text-sm px-2 text-right bg-white" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={rightBaseH} onValueChange={setRightBaseH}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px] bg-white">
                    <SelectValue placeholder="בחר" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseHOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
                <span className="text-2xl font-bold">+</span>
              </div>
              <div className="w-24 flex-shrink-0">
                <Input 
                  type="number" 
                  step="0.5" 
                  value={rightPrisV || ""} 
                  onChange={(e) => setRightPrisV(Number(e.target.value))} 
                  className="h-9 pr-1 text-sm px-2 text-right bg-white" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={rightBaseV} onValueChange={setRightBaseV}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px] bg-white">
                    <SelectValue placeholder="בחר" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseVOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full min-w-fit" dir="ltr">
            <span className="text-lg font-medium w-8 text-center flex-shrink-0">L</span>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="w-24 flex-shrink-0">
                <Input 
                  type="number" 
                  step="0.5" 
                  value={leftPrisH || ""} 
                  onChange={(e) => setLeftPrisH(Number(e.target.value))} 
                  className="h-9 pr-1 text-sm px-2 text-right bg-white" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={leftBaseH} onValueChange={setLeftBaseH}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px] bg-white">
                    <SelectValue placeholder="בחר" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseHOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
                <span className="text-2xl font-bold">+</span>
              </div>
              <div className="w-24 flex-shrink-0">
                <Input 
                  type="number" 
                  step="0.5" 
                  value={leftPrisV || ""} 
                  onChange={(e) => setLeftPrisV(Number(e.target.value))} 
                  className="h-9 pr-1 text-sm px-2 text-right bg-white" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={leftBaseV} onValueChange={setLeftBaseV}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px] bg-white">
                    <SelectValue placeholder="בחר" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseVOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <Button onClick={handleConfirm} type="button" className="px-8">אישור</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FinalSubjectiveTabProps {
  finalSubjectiveData: FinalSubjectiveExam;
  onFinalSubjectiveChange: (field: keyof FinalSubjectiveExam, value: string) => void;
  isEditing: boolean;
  onVHConfirm: (rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string, leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string) => void;
  hideEyeLabels?: boolean;
}

export function FinalSubjectiveTab({
  finalSubjectiveData,
  onFinalSubjectiveChange,
  isEditing,
  onVHConfirm,
  hideEyeLabels = false
}: FinalSubjectiveTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const columns = [
    { key: "sph", label: "SPH", step: "0.25" },
    { key: "cyl", label: "CYL", step: "0.25" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "pr_h", label: "PR.H", step: "0.5" },
    { key: "base_h", label: "BASE.H", type: "select", options: ["IN", "OUT"] },
    { key: "pr_v", label: "PR.V", step: "0.5" },
    { key: "base_v", label: "BASE.V", type: "select", options: ["UP", "DOWN"] },
    { key: "va", label: "VA", step: "0.1", type: "va" },
    { key: "j", label: "J", step: "1" },
    { key: "pd_close", label: "PD CLOSE", step: "0.5" },
    { key: "pd_far", label: "PD FAR", step: "0.5" },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof FinalSubjectiveExam;
      return finalSubjectiveData[combField]?.toString() || "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof FinalSubjectiveExam;
    return finalSubjectiveData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye === "C") {
      const combField = `comb_${field}` as keyof FinalSubjectiveExam;
      onFinalSubjectiveChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof FinalSubjectiveExam;
      onFinalSubjectiveChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof FinalSubjectiveExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof FinalSubjectiveExam;
      const value = finalSubjectiveData[fromField]?.toString() || "";
      onFinalSubjectiveChange(toField, value);
    });
  };

  const renderInput = (eye: "R" | "L", { key, step, min, max, type, options }: (typeof columns)[number]) => {
    switch (type) {
      case "va":
        return (
          <div className="relative">
            <Input
              type="number" step={step} value={getFieldValue(eye, key)}
              onChange={(e) => handleChange(eye, key, e.target.value)}
              disabled={!isEditing}
              className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
            />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        );
      case "select":
        return (
          <Select value={getFieldValue(eye, key)} onValueChange={(value) => handleChange(eye, key, value)} disabled={!isEditing}>
            <SelectTrigger size="xs" className={`h-8 text-xs w-full ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100`}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      default:
        return (
          <Input
            type="number" step={step} min={min} max={max}
            value={getFieldValue(eye, key)}
            onChange={(e) => handleChange(eye, key, e.target.value)}
            disabled={!isEditing}
            className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
          />
        );
    }
  };

  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Final Subjective</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(11,1fr)]' : 'grid-cols-[20px_repeat(11,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground text-center">
                  {label}
                </span>
              </div>
            ))}
            
            {!hideEyeLabels && <div className="flex items-center justify-center">
              <span 
                className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                onMouseEnter={() => setHoveredEye("R")}
                onMouseLeave={() => setHoveredEye(null)}
                onClick={() => copyFromOtherEye("L")}
                title="Click to copy from L eye"
              >
                {hoveredEye === "L" ? <ChevronDown size={16} /> : "R"}
              </span>
            </div>}
            {columns.map(col => <div key={`r-${col.key}`}>{renderInput("R", col)}</div>)}
            
            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {columns.map(({ key, step }) => {
              if (key === 'pr_v') {
                return (
                  <div key="c-vh-calculator" className="flex justify-center">
                    <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
                  </div>
                );
              }
              if (key === 'va') {
                return (
                  <div key="c-va-input" className="relative">
                    <Input
                      type="number" step={step} value={getFieldValue("C", "va")}
                      onChange={(e) => handleChange("C", "va", e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                  </div>
                );
              }
              if (key === 'pd_close' || key === 'pd_far') {
                 return (
                  <Input
                    key={`c-${key}`} type="number" step={step} value={getFieldValue("C", key)}
                    onChange={(e) => handleChange("C", key, e.target.value)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                );
              }
              return <div key={`c-spacer-${key}`} />;
            })}
            
            {!hideEyeLabels && <div className="flex items-center justify-center">
              <span 
                className="text-base font-medium cursor-pointer hover:bg-accent rounded-full px-2"
                onMouseEnter={() => setHoveredEye("L")}
                onMouseLeave={() => setHoveredEye(null)}
                onClick={() => copyFromOtherEye("R")}
                title="Click to copy from R eye"
              >
                {hoveredEye === "R" ? <ChevronUp size={16} /> : "L"}
              </span>
            </div>}
            {columns.map(col => <div key={`l-${col.key}`}>{renderInput("L", col)}</div>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 