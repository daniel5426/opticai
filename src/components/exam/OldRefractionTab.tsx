import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { OldRefractionExam } from "@/lib/db/schema"
import { ChevronUp, ChevronDown } from "lucide-react"

interface VHCalculatorProps {
  onConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
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

  const baseOptions = ["IN", "OUT", "UP", "DOWN"];

  const calculateResultingPrism = (prisH: number, baseH: string, prisV: number, baseV: string) => {
    if (!prisH && !prisV) return { pris: 0, base: 0 };
    
    let hComponent = 0, vComponent = 0;
    
    if (baseH === "IN") hComponent = -prisH;
    else if (baseH === "OUT") hComponent = prisH;
    
    if (baseV === "UP") vComponent = prisV;
    else if (baseV === "DOWN") vComponent = -prisV;
    
    const resultingPris = Math.sqrt(hComponent * hComponent + vComponent * vComponent);
    let resultingBase = 0;
    
    if (hComponent !== 0 || vComponent !== 0) {
      resultingBase = Math.atan2(vComponent, hComponent) * (180 / Math.PI);
      if (resultingBase < 0) resultingBase += 360;
    }
    
    return {
      pris: Math.round(resultingPris * 100) / 100,
      base: Math.round(resultingBase)
    };
  };

  const rightResult = calculateResultingPrism(rightPrisH, rightBaseH, rightPrisV, rightBaseV);
  const leftResult = calculateResultingPrism(leftPrisH, leftBaseH, leftPrisV, leftBaseV);

  const handleConfirm = () => {
    onConfirm(rightResult.pris, rightResult.base, leftResult.pris, leftResult.base);
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
          <DialogTitle className="text-center text-2xl">חישוב פריזמה</DialogTitle>
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
              <div className="w-10 flex justify-center flex-shrink-0">
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">PRIS</Label>
              </div>
              <div className="w-24 flex-shrink-0">
                <Label className="text-xs block text-center mb-1">BASE</Label>
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
                    {baseOptions.map(option => (
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
                    {baseOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
                <span className="text-2xl font-bold">=</span>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center bg-gray-50 font-medium">
                  {rightResult.pris}
                </div>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center bg-gray-50 font-medium">
                  {rightResult.base}°
                </div>
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
                    {baseOptions.map(option => (
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
                    {baseOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-10 flex justify-center flex-shrink-0">
                <span className="text-2xl font-bold">=</span>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center bg-gray-50 font-medium">
                  {leftResult.pris}
                </div>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center bg-gray-50 font-medium">
                  {leftResult.base}°
                </div>
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

interface OldRefractionTabProps {
  oldRefractionData: OldRefractionExam;
  onOldRefractionChange: (field: keyof OldRefractionExam, value: string) => void;
  isEditing: boolean;
  onMultifocalClick: () => void;
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  hideEyeLabels?: boolean;
}

export function OldRefractionTab({
  oldRefractionData,
  onOldRefractionChange,
  isEditing,
  onMultifocalClick,
  onVHConfirm,
  hideEyeLabels = false
}: OldRefractionTabProps) {
  const [hoveredEye, setHoveredEye] = useState<"R" | "L" | null>(null);

  const columns = [
    { key: "sph", label: "SPH", step: "0.25" },
    { key: "cyl", label: "CYL", step: "0.25" },
    { key: "ax", label: "AXIS", step: "1", min: "0", max: "180" },
    { key: "pris", label: "PRIS", step: "0.5" },
    { key: "base", label: "BASE", step: "0.1" },
    { key: "va", label: "VA", step: "0.1" },
    { key: "ad", label: "ADD", step: "0.25" },
  ];

  const getFieldValue = (eye: "R" | "L" | "C", field: string) => {
    if (eye === "C") {
      const combField = `comb_va` as keyof OldRefractionExam;
      return oldRefractionData[combField]?.toString() || "";
    }
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
    return oldRefractionData[eyeField]?.toString() || "";
  };

  const handleChange = (eye: "R" | "L" | "C", field: string, value: string) => {
    if (eye === "C") {
      const combField = `comb_va` as keyof OldRefractionExam;
      onOldRefractionChange(combField, value);
    } else {
      const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
      onOldRefractionChange(eyeField, value);
    }
  };

  const copyFromOtherEye = (fromEye: "R" | "L") => {
    const toEye = fromEye === "R" ? "L" : "R";
    columns.forEach(({ key }) => {
      const fromField = `${fromEye.toLowerCase()}_${key}` as keyof OldRefractionExam;
      const toField = `${toEye.toLowerCase()}_${key}` as keyof OldRefractionExam;
      const value = oldRefractionData[fromField]?.toString() || "";
      onOldRefractionChange(toField, value);
    });
  };

  return (
    <Card className="w-full shadow-md border-none pb-4 pt-3">
      <CardContent className="px-4" style={{scrollbarWidth: 'none'}}>
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-medium text-muted-foreground">Old Refraction</h3>
          </div>
          
          <div className={`grid ${hideEyeLabels ? 'grid-cols-[repeat(7,1fr)]' : 'grid-cols-[20px_repeat(7,1fr)]'} gap-2 items-center`}>
            {!hideEyeLabels && <div></div>}
            {columns.map(({ key, label }) => (
              <div key={key} className="h-4 flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
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
            {columns.map(({ key, step, min, max }) => (
              <div key={`r-${key}`}>
                {key === "va" ? (
                  <div className="relative">
                    <Input
                      type="number"
                      step={step}
                      value={getFieldValue("R", key)}
                      onChange={(e) => handleChange("R", key, e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={getFieldValue("R", key)}
                    onChange={(e) => handleChange("R", key, e.target.value)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}
            
            {!hideEyeLabels && <div className="flex items-center justify-center h-8">
            </div>}
            {columns.map(({ key, step }) => {
              if (key === 'cyl') {
                return (
                  <div key="c-mul-button" className="flex justify-center">
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className={`h-8 text-xs px-2 ${!isEditing ? 'bg-accent/50' : 'bg-white'}`}
                      disabled={!isEditing}
                      onClick={onMultifocalClick}
                    >
                      MUL
                    </Button>
                  </div>
                )
              }
              if (key === 'pris') {
                return (
                  <div key="c-vh-calculator" className="flex justify-center">
                    <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
                  </div>
                )
              }
              if (key === 'va') {
                return (
                  <div key="c-va-input" className="relative">
                    <Input
                      type="number"
                      step={step}
                      value={getFieldValue("C", "va")}
                      onChange={(e) => handleChange("C", "va", e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                  </div>
                )
              }
              return <div key={`c-spacer-${key}`} />
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
            {columns.map(({ key, step, min, max }) => (
              <div key={`l-${key}`}>
                {key === "va" ? (
                  <div className="relative">
                    <Input
                      type="number"
                      step={step}
                      value={getFieldValue("L", key)}
                      onChange={(e) => handleChange("L", key, e.target.value)}
                      disabled={!isEditing}
                      className={`h-8 pr-1 text-xs pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                    />
                    <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={getFieldValue("L", key)}
                    onChange={(e) => handleChange("L", key, e.target.value)}
                    disabled={!isEditing}
                    className={`h-8 pr-1 text-xs ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 