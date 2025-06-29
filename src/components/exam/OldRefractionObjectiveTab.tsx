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
  oldRefractionData: OldRefractionExam;
  objectiveData: ObjectiveExam;
  onOldRefractionChange: (field: keyof OldRefractionExam, value: string) => void;
  onObjectiveChange: (field: keyof ObjectiveExam, value: string) => void;
  isEditing: boolean;
}

function PreviousObjectiveSection({ eye, oldRefractionData, objectiveData, onOldRefractionChange, onObjectiveChange, isEditing }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  const getOldRefractionFieldValue = (field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
    return oldRefractionData[eyeField]?.toString() || "";
  };

  const getObjectiveFieldValue = (field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof ObjectiveExam;
    return objectiveData[eyeField]?.toString() || "";
  };

  const handleOldRefractionChange = (field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof OldRefractionExam;
    onOldRefractionChange(eyeField, value);
  };

  const handleObjectiveChange = (field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof ObjectiveExam;
    onObjectiveChange(eyeField, value);
  };

  return (
    <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
      <div className="grid grid-cols-24 gap-4 flex-1 pb-2" dir="ltr">
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-sph`} className="text-[12px] block text-center">SPH</Label>}
          <Input id={`${eye}-old-sph`} type="number" step="0.25" value={getOldRefractionFieldValue("sph")} onChange={(e) => handleOldRefractionChange("sph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-cyl`} className="text-[12px] block text-center">CYL</Label>}
          <Input id={`${eye}-old-cyl`} type="number" step="0.25" value={getOldRefractionFieldValue("cyl")} onChange={(e) => handleOldRefractionChange("cyl", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-ax`} className="text-[12px] block text-center">AXIS</Label>}
          <Input id={`${eye}-old-ax`} type="number" min="0" max="180" value={getOldRefractionFieldValue("ax")} onChange={(e) => handleOldRefractionChange("ax", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-pris`} className="text-[12px] block text-center">PRIS</Label>}
          <Input id={`${eye}-old-pris`} type="number" step="0.5" value={getOldRefractionFieldValue("pris")} onChange={(e) => handleOldRefractionChange("pris", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-base`} className="text-[12px] block text-center">BASE</Label>}
          <Input id={`${eye}-old-base`} type="number" step="0.1" value={getOldRefractionFieldValue("base")} onChange={(e) => handleOldRefractionChange("base", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-3">
          {eye === "R" && <Label htmlFor={`${eye}-old-va`} className="text-[12px] block text-center">VA</Label>}
          <div className="relative" dir="ltr">
            <Input id={`${eye}-old-va`} type="number" step="0.1" value={getOldRefractionFieldValue("va")} onChange={(e) => handleOldRefractionChange("va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1 pl-6" placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-old-ad`} className="text-[12px] block text-center">ADD</Label>}
          <Input id={`${eye}-old-ad`} type="number" step="0.25" value={getOldRefractionFieldValue("ad")} onChange={(e) => handleOldRefractionChange("ad", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>

        <div className="col-span-1 flex items-end justify-center"><div className="w-px h-full bg-gray-300"></div></div>

        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-obj-sph`} className="text-[12px] block text-center">SPH</Label>}
          <Input id={`${eye}-obj-sph`} type="number" step="0.25" value={getObjectiveFieldValue("sph")} onChange={(e) => handleObjectiveChange("sph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-obj-cyl`} className="text-[12px] block text-center">CYL</Label>}
          <Input id={`${eye}-obj-cyl`} type="number" step="0.25" value={getObjectiveFieldValue("cyl")} onChange={(e) => handleObjectiveChange("cyl", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-obj-ax`} className="text-[12px] block text-center">AXIS</Label>}
          <Input id={`${eye}-obj-ax`} type="number" min="0" max="180" value={getObjectiveFieldValue("ax")} onChange={(e) => handleObjectiveChange("ax", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-obj-se`} className="text-[12px] block text-center">SE</Label>}
          <Input id={`${eye}-obj-se`} type="number" step="0.25" value={getObjectiveFieldValue("se")} onChange={(e) => handleObjectiveChange("se", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
      </div>
      <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-2" : "pt-2"}`}>{eyeLabel}</span>
    </div>
  );
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
        <Button variant="outline" size="sm" className="h-8 text-xs px-2" type="button" disabled={disabled}>
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
                  className="h-9 text-sm px-2 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={rightBaseH} onValueChange={setRightBaseH}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px]">
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
                  className="h-9 text-sm px-2 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={rightBaseV} onValueChange={setRightBaseV}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px]">
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
                  className="h-9 text-sm px-2 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={leftBaseH} onValueChange={setLeftBaseH}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px]">
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
                  className="h-9 text-sm px-2 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={leftBaseV} onValueChange={setLeftBaseV}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px]">
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

function CombinedVaFields({ oldRefractionData, onOldRefractionChange, isEditing, onMultifocalClick, onVHConfirm }: { 
  oldRefractionData: OldRefractionExam, 
  onOldRefractionChange: (field: keyof OldRefractionExam, value: string) => void, 
  isEditing: boolean,
  onMultifocalClick: () => void,
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void
}) {
  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-24 gap-4 flex-1" dir="ltr">
        <div className="col-span-2"></div>
        <div className="col-span-2 flex justify-center items-center">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            className="h-8 text-xs px-2" 
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
            <Input id={`comb-old-va`} type="number" step="0.1" value={oldRefractionData.comb_va?.toString() || ""} onChange={(e) => onOldRefractionChange("comb_va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1 pl-6" placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2"></div>
        <div className="col-span-1"></div>
        <div className="col-span-6"></div>
      </div>
      <span className="text-md font-medium pr-2 flex items-center justify-center w-6">C</span>
    </div>
  );
}

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
    <Card className="shadow-md border-none">
      <CardContent className="px-4 pt-4 space-y-1">
        <div className="relative mb-4 pt-2" dir="rtl">
          <div className="absolute top-[-27px] left-[calc(100%*20/27)] transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
            Objective
          </div>
          <div className="absolute top-[-27px] left-[calc(100%*6/29)] transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
            Old refraction
          </div>
        </div>
        <PreviousObjectiveSection eye="R" oldRefractionData={oldRefractionData} objectiveData={objectiveData} onOldRefractionChange={onOldRefractionChange} onObjectiveChange={onObjectiveChange} isEditing={isEditing} />
        <CombinedVaFields oldRefractionData={oldRefractionData} onOldRefractionChange={onOldRefractionChange} isEditing={isEditing} onMultifocalClick={onMultifocalClick} onVHConfirm={onVHConfirm} />
        <PreviousObjectiveSection eye="L" oldRefractionData={oldRefractionData} objectiveData={objectiveData} onOldRefractionChange={onOldRefractionChange} onObjectiveChange={onObjectiveChange} isEditing={isEditing} />
      </CardContent>
    </Card>
  );
} 