import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { OpticalExam, OldRefractionExam, ObjectiveExam } from "@/lib/db/schema"
import { toast } from "sonner"

interface EyeSectionProps {
  eye: "R" | "L";
  data: OldRefractionExam | ObjectiveExam;
  onChange: (field: keyof (OldRefractionExam | ObjectiveExam), value: string) => void;
  isEditing: boolean;
  type: 'old-refraction' | 'objective';
  hideLabels?: boolean;
}

function EyeSection({ eye, data, onChange, isEditing, type, hideLabels = false }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  const getFieldValue = (field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof (OldRefractionExam | ObjectiveExam);
    return data[eyeField]?.toString() || "";
  };

  const handleChange = (field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof (OldRefractionExam | ObjectiveExam);
    onChange(eyeField, value);
  };

  if (type === 'old-refraction') {
      return (
    <div className="flex items-center gap-1 h-6" dir="rtl">
        <div className="grid grid-cols-15 gap-4 flex-1 w-full" dir="ltr">
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-old-sph`} className="text-[12px] block text-center">SPH</Label>}
            <Input id={`${eye}-old-sph`} type="number" step="0.25" value={getFieldValue("sph")} onChange={(e) => handleChange("sph", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
          </div>
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-old-cyl`} className="text-[12px] block text-center">CYL</Label>}
            <Input id={`${eye}-old-cyl`} type="number" step="0.25" value={getFieldValue("cyl")} onChange={(e) => handleChange("cyl", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
          </div>
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-old-ax`} className="text-[12px] block text-center">AXIS</Label>}
            <Input id={`${eye}-old-ax`} type="number" min="0" max="180" value={getFieldValue("ax")} onChange={(e) => handleChange("ax", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
          </div>
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-old-pris`} className="text-[12px] block text-center">PRIS</Label>}
            <Input id={`${eye}-old-pris`} type="number" step="0.5" value={getFieldValue("pris")} onChange={(e) => handleChange("pris", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
          </div>
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-old-base`} className="text-[12px] block text-center">BASE</Label>}
            <Input id={`${eye}-old-base`} type="number" step="0.1" value={getFieldValue("base")} onChange={(e) => handleChange("base", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
          </div>
          <div className="col-span-3">
            {eye === "R" && <Label htmlFor={`${eye}-old-va`} className="text-[12px] block text-center">VA</Label>}
            <div className="relative" dir="ltr">
              <Input id={`${eye}-old-va`} type="number" step="0.1" value={getFieldValue("va")} onChange={(e) => handleChange("va", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
              <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
            </div>
          </div>
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-old-ad`} className="text-[12px] block text-center">ADD</Label>}
            <Input id={`${eye}-old-ad`} type="number" step="0.25" value={getFieldValue("ad")} onChange={(e) => handleChange("ad", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
          </div>
        </div>
        {!hideLabels && <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "" : "pt-4"}`}>{eyeLabel}</span>}
      </div>
    );
  }

  if (type === 'objective') {
    return (
      <div className="flex items-center gap-1 h-6" dir="rtl">
        <div className="grid grid-cols-8 gap-4 flex-1 w-full" dir="ltr">
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-obj-sph`} className="text-[12px] block text-center">SPH</Label>}
            <Input id={`${eye}-obj-sph`} type="number" step="0.25" value={getFieldValue("sph")} onChange={(e) => handleChange("sph", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
          </div>
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-obj-cyl`} className="text-[12px] block text-center">CYL</Label>}
            <Input id={`${eye}-obj-cyl`} type="number" step="0.25" value={getFieldValue("cyl")} onChange={(e) => handleChange("cyl", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
          </div>
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-obj-ax`} className="text-[12px] block text-center">AXIS</Label>}
            <Input id={`${eye}-obj-ax`} type="number" min="0" max="180" value={getFieldValue("ax")} onChange={(e) => handleChange("ax", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
          </div>
          <div className="col-span-2">
            {eye === "R" && <Label htmlFor={`${eye}-obj-se`} className="text-[12px] block text-center">SE</Label>}
            <Input id={`${eye}-obj-se`} type="number" step="0.25" value={getFieldValue("se")} onChange={(e) => handleChange("se", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
          </div>
        </div>
        {!hideLabels && <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "" : "pt-4"}`}>{eyeLabel}</span>}
      </div>
    );
  }

  return null;
}

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
                  className="h-9 text-sm px-2 text-right bg-white" 
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
                  className="h-9 text-sm px-2 text-right bg-white" 
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
                  className="h-9 text-sm px-2 text-right bg-white" 
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
                  className="h-9 text-sm px-2 text-right bg-white" 
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

function CombinedVaFields({ oldRefractionData, onOldRefractionChange, isEditing, onMultifocalClick, onVHConfirm, hideLabels = false }: { 
  oldRefractionData: OldRefractionExam, 
  onOldRefractionChange: (field: keyof OldRefractionExam, value: string) => void, 
  isEditing: boolean,
  onMultifocalClick: () => void,
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void,
  hideLabels?: boolean
}) {
  return (
    <div className="flex items-center gap-1 h-10 my-2 mt-4" dir="rtl">
      <div className="grid grid-cols-15 gap-4 flex-1 w-full" dir="ltr">
        <div className="col-span-2"></div>
        <div className="col-span-2 flex justify-center items-center">
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
        <div className="col-span-2"></div>
        <div className="col-span-2 flex justify-center items-center">
          <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
        </div>
        <div className="col-span-2"></div>
        <div className="col-span-3">
          <div className="relative" dir="ltr">
            <Input id={`comb-old-va`} type="number" step="0.1" value={oldRefractionData.comb_va?.toString() || ""} onChange={(e) => onOldRefractionChange("comb_va", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2"></div>
      </div>
      {!hideLabels && <span className="text-md font-medium pr-2 flex items-center justify-center w-6">C</span>}
    </div>
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
  return (
    <Card className="w-full shadow-md border-[1px] ">
      <CardContent className="px-4 pt-4 space-y-1">
        <div className="relative mb-4 pt-2" dir="rtl">
          <div className="absolute top-[-27px] left-1/2 transform -translate-x-1/2 px-2 font-medium text-muted-foreground">
            Old refraction
          </div>
        </div>
        <EyeSection eye="R" data={oldRefractionData} onChange={onOldRefractionChange} isEditing={isEditing} type="old-refraction" hideLabels={hideEyeLabels} />
        <CombinedVaFields oldRefractionData={oldRefractionData} onOldRefractionChange={onOldRefractionChange} isEditing={isEditing} onMultifocalClick={onMultifocalClick} onVHConfirm={onVHConfirm} hideLabels={hideEyeLabels} />
        <EyeSection eye="L" data={oldRefractionData} onChange={onOldRefractionChange} isEditing={isEditing} type="old-refraction" hideLabels={hideEyeLabels} />
      </CardContent>
    </Card>
  );
}

interface ObjectiveTabProps {
  objectiveData: ObjectiveExam;
  onObjectiveChange: (field: keyof ObjectiveExam, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
  needsMiddleSpacer?: boolean;
}

export function ObjectiveTab({
  objectiveData,
  onObjectiveChange,
  isEditing,
  hideEyeLabels = false,
  needsMiddleSpacer = false
}: ObjectiveTabProps) {
  return (
    <Card className="w-full shadow-md border-[1px] ">
      <CardContent className="px-4 pt-4 space-y-1">
        <div className="relative mb-4 pt-2" dir="rtl">
          <div className="absolute top-[-27px] left-1/2 transform -translate-x-1/2 px-2 font-medium text-muted-foreground">
            Objective
          </div>
        </div>
        <EyeSection eye="R" data={objectiveData} onChange={onObjectiveChange} isEditing={isEditing} type="objective" hideLabels={hideEyeLabels} />
        {needsMiddleSpacer && <div className="h-7 mb-2"></div>}
        <div className="h-3 mb-3"></div>
        <EyeSection eye="L" data={objectiveData} onChange={onObjectiveChange} isEditing={isEditing} type="objective" hideLabels={hideEyeLabels} />
      </CardContent>
    </Card>
  );
}

// Keep the original combined component for backward compatibility
interface OldRefractionObjectiveTabProps {
  oldRefractionData: OldRefractionExam;
  objectiveData: ObjectiveExam;
  onOldRefractionChange: (field: keyof OldRefractionExam, value: string) => void;
  onObjectiveChange: (field: keyof ObjectiveExam, value: string) => void;
  isEditing: boolean;
  onMultifocalClick: () => void;
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
}

export function OldRefractionObjectiveTab({
  oldRefractionData,
  objectiveData,
  onOldRefractionChange,
  onObjectiveChange,
  isEditing,
  onMultifocalClick,
  onVHConfirm
}: OldRefractionObjectiveTabProps) {
  return (
    <Card className="w-full shadow-md border-[1px] ">
      <CardContent className="px-4 pt-4 space-y-1">
        <div className="relative mb-4 pt-2" dir="rtl">
          <div className="absolute top-[-27px] left-[calc(100%*20/27)] transform translate-x-1/2 px-2 font-medium text-muted-foreground">
            Objective
          </div>
          <div className="absolute top-[-27px] left-[calc(100%*6/29)] transform translate-x-1/2 px-2 font-medium text-muted-foreground">
            Old refraction
          </div>
        </div>
        <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
          <div className="grid grid-cols-24 gap-4 flex-1 pb-2 w-full" dir="ltr">
            <div className="col-span-2">
              <Label htmlFor="R-old-sph" className="text-[12px] block text-center">SPH</Label>
              <Input id="R-old-sph" type="number" step="0.25" value={oldRefractionData.r_sph?.toString() || ""} onChange={(e) => onOldRefractionChange("r_sph", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="R-old-cyl" className="text-[12px] block text-center">CYL</Label>
              <Input id="R-old-cyl" type="number" step="0.25" value={oldRefractionData.r_cyl?.toString() || ""} onChange={(e) => onOldRefractionChange("r_cyl", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="R-old-ax" className="text-[12px] block text-center">AXIS</Label>
              <Input id="R-old-ax" type="number" min="0" max="180" value={oldRefractionData.r_ax?.toString() || ""} onChange={(e) => onOldRefractionChange("r_ax", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="R-old-pris" className="text-[12px] block text-center">PRIS</Label>
              <Input id="R-old-pris" type="number" step="0.5" value={oldRefractionData.r_pris?.toString() || ""} onChange={(e) => onOldRefractionChange("r_pris", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="R-old-base" className="text-[12px] block text-center">BASE</Label>
              <Input id="R-old-base" type="number" step="0.1" value={oldRefractionData.r_base?.toString() || ""} onChange={(e) => onOldRefractionChange("r_base", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
            </div>
            <div className="col-span-3">
              <Label htmlFor="R-old-va" className="text-[12px] block text-center">VA</Label>
              <div className="relative" dir="ltr">
                <Input id="R-old-va" type="number" step="0.1" value={oldRefractionData.r_va?.toString() || ""} onChange={(e) => onOldRefractionChange("r_va", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
                <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
              </div>
            </div>
            <div className="col-span-2">
              <Label htmlFor="R-old-ad" className="text-[12px] block text-center">ADD</Label>
              <Input id="R-old-ad" type="number" step="0.25" value={oldRefractionData.r_ad?.toString() || ""} onChange={(e) => onOldRefractionChange("r_ad", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>

            <div className="col-span-1 flex items-end justify-center"><div className="w-px h-full bg-gray-300"></div></div>

            <div className="col-span-2">
              <Label htmlFor="R-obj-sph" className="text-[12px] block text-center">SPH</Label>
              <Input id="R-obj-sph" type="number" step="0.25" value={objectiveData.r_sph?.toString() || ""} onChange={(e) => onObjectiveChange("r_sph", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="R-obj-cyl" className="text-[12px] block text-center">CYL</Label>
              <Input id="R-obj-cyl" type="number" step="0.25" value={objectiveData.r_cyl?.toString() || ""} onChange={(e) => onObjectiveChange("r_cyl", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="R-obj-ax" className="text-[12px] block text-center">AXIS</Label>
              <Input id="R-obj-ax" type="number" min="0" max="180" value={objectiveData.r_ax?.toString() || ""} onChange={(e) => onObjectiveChange("r_ax", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="R-obj-se" className="text-[12px] block text-center">SE</Label>
              <Input id="R-obj-se" type="number" step="0.25" value={objectiveData.r_se?.toString() || ""} onChange={(e) => onObjectiveChange("r_se", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
          </div>
          <span className="text-md font-medium pr-2 flex items-center justify-center w-6 pt-2">R</span>
        </div>
        <CombinedVaFields oldRefractionData={oldRefractionData} onOldRefractionChange={onOldRefractionChange} isEditing={isEditing} onMultifocalClick={onMultifocalClick} onVHConfirm={onVHConfirm} />
        <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
          <div className="grid grid-cols-24 gap-4 flex-1 pb-2 w-full" dir="ltr">
            <div className="col-span-2">
              <Input id="L-old-sph" type="number" step="0.25" value={oldRefractionData.l_sph?.toString() || ""} onChange={(e) => onOldRefractionChange("l_sph", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Input id="L-old-cyl" type="number" step="0.25" value={oldRefractionData.l_cyl?.toString() || ""} onChange={(e) => onOldRefractionChange("l_cyl", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Input id="L-old-ax" type="number" min="0" max="180" value={oldRefractionData.l_ax?.toString() || ""} onChange={(e) => onOldRefractionChange("l_ax", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
            </div>
            <div className="col-span-2">
              <Input id="L-old-pris" type="number" step="0.5" value={oldRefractionData.l_pris?.toString() || ""} onChange={(e) => onOldRefractionChange("l_pris", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
            </div>
            <div className="col-span-2">
              <Input id="L-old-base" type="number" step="0.1" value={oldRefractionData.l_base?.toString() || ""} onChange={(e) => onOldRefractionChange("l_base", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
            </div>
            <div className="col-span-3">
              <div className="relative" dir="ltr">
                <Input id="L-old-va" type="number" step="0.1" value={oldRefractionData.l_va?.toString() || ""} onChange={(e) => onOldRefractionChange("l_va", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
                <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
              </div>
            </div>
            <div className="col-span-2">
              <Input id="L-old-ad" type="number" step="0.25" value={oldRefractionData.l_ad?.toString() || ""} onChange={(e) => onOldRefractionChange("l_ad", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>

            <div className="col-span-1 flex items-end justify-center"><div className="w-px h-full bg-gray-300"></div></div>

            <div className="col-span-2">
              <Input id="L-obj-sph" type="number" step="0.25" value={objectiveData.l_sph?.toString() || ""} onChange={(e) => onObjectiveChange("l_sph", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Input id="L-obj-cyl" type="number" step="0.25" value={objectiveData.l_cyl?.toString() || ""} onChange={(e) => onObjectiveChange("l_cyl", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Input id="L-obj-ax" type="number" min="0" max="180" value={objectiveData.l_ax?.toString() || ""} onChange={(e) => onObjectiveChange("l_ax", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
            </div>
            <div className="col-span-2">
              <Input id="L-obj-se" type="number" step="0.25" value={objectiveData.l_se?.toString() || ""} onChange={(e) => onObjectiveChange("l_se", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
            </div>
          </div>
          <span className="text-md font-medium pr-2 flex items-center justify-center w-6 pb-2">L</span>
        </div>
      </CardContent>
    </Card>
  );
} 