import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { OpticalExam, SubjectiveExam } from "@/lib/db/schema"
import { toast } from "sonner"

interface EyeSectionProps {
  eye: "R" | "L";
  data: SubjectiveExam;
  onChange: (field: keyof SubjectiveExam, value: string) => void;
  isEditing: boolean;
  hideLabels?: boolean;
}

function SubjectiveSection({ eye, data, onChange, isEditing, hideLabels = false }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  const getFieldValue = (field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof SubjectiveExam;
    return data[eyeField]?.toString() || "";
  };

  const handleChange = (field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof SubjectiveExam;
    onChange(eyeField, value);
  };

  return (
    <div className="flex items-center gap-1 h-6" dir="rtl">
      <div className="grid grid-cols-20 gap-4 flex-1 w-full" dir="ltr">
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-fa`} className="text-[12px] block text-center">FA</Label>}
          <Input id={`${eye}-subj-fa`} type="number" step="0.1" value={getFieldValue("fa")} onChange={(e) => handleChange("fa", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="FA" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-fa-tuning`} className="text-[12px] block text-center">FA TUN</Label>}
          <Input id={`${eye}-subj-fa-tuning`} type="number" step="0.1" value={getFieldValue("fa_tuning")} onChange={(e) => handleChange("fa_tuning", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="FA TUN" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-sph`} className="text-[12px] block text-center">SPH</Label>}
          <Input id={`${eye}-subj-sph`} type="number" step="0.25" value={getFieldValue("sph")} onChange={(e) => handleChange("sph", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-cyl`} className="text-[12px] block text-center">CYL</Label>}
          <Input id={`${eye}-subj-cyl`} type="number" step="0.25" value={getFieldValue("cyl")} onChange={(e) => handleChange("cyl", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-ax`} className="text-[12px] block text-center">AXIS</Label>}
          <Input id={`${eye}-subj-ax`} type="number" min="0" max="180" value={getFieldValue("ax")} onChange={(e) => handleChange("ax", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-pris`} className="text-[12px] block text-center">PRIS</Label>}
          <Input id={`${eye}-subj-pris`} type="number" step="0.5" value={getFieldValue("pris")} onChange={(e) => handleChange("pris", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-base`} className="text-[12px] block text-center">BASE</Label>}
          <Input id={`${eye}-subj-base`} type="number" step="0.1" value={getFieldValue("base")} onChange={(e) => handleChange("base", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
        </div>
        <div className="col-span-2">
        {eye === "R" && <Label htmlFor={`${eye}-old-va`} className="text-[12px] block text-center">VA</Label>}
          <div className="relative" dir="ltr">
            <Input id={`${eye}-old-va`} type="number" step="0.1" value={getFieldValue("va")} onChange={(e) => handleChange("va", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-pd-close`} className="text-[12px] block text-center">PD CLOSE</Label>}
          <Input id={`${eye}-subj-pd-close`} type="number" step="0.5" value={getFieldValue("pd_close")} onChange={(e) => handleChange("pd_close", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="PD" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-subj-pd-far`} className="text-[12px] block text-center">PD FAR</Label>}
          <Input id={`${eye}-subj-pd-far`} type="number" step="0.5" value={getFieldValue("pd_far")} onChange={(e) => handleChange("pd_far", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="PD" />
        </div>
      </div>
      {!hideLabels && <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "" : "pt-4"}`}>{eyeLabel}</span>}
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

function CombinedSubjFields({ subjectiveData, onSubjectiveChange, isEditing, onVHConfirm, onMultifocalClick, hideLabels = false }: { 
  subjectiveData: SubjectiveExam, 
  onSubjectiveChange: (field: keyof SubjectiveExam, value: string) => void, 
  isEditing: boolean,
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void,
  onMultifocalClick: () => void,
  hideLabels?: boolean
}) {
  return (
    <div className="flex items-center gap-1 h-10 my-2 mt-4" dir="rtl">
      <div className="grid grid-cols-20 gap-4 flex-1 w-full" dir="ltr">
        <div className="col-span-2">
          <Input type="number" step="0.1" value={subjectiveData.comb_fa?.toString() || ""} onChange={(e) => onSubjectiveChange("comb_fa", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="FA" />
        </div>
        <div className="col-span-2">
          <Input type="number" step="0.1" value={subjectiveData.comb_fa_tuning?.toString() || ""} onChange={(e) => onSubjectiveChange("comb_fa_tuning", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="FA TUN" />
        </div>
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
        <div className="col-span-2">
        <div className="relative" dir="ltr">
            <Input id={`comb-subj-va`} type="number" step="0.1" value={subjectiveData.comb_va?.toString() || ""} onChange={(e) => onSubjectiveChange("comb_va", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2">
          <Input type="number" step="0.5" value={subjectiveData.comb_pd_close?.toString() || ""} onChange={(e) => onSubjectiveChange("comb_pd_close", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="PD Close" />
        </div>
        <div className="col-span-2">
          <Input type="number" step="0.5" value={subjectiveData.comb_pd_far?.toString() || ""} onChange={(e) => onSubjectiveChange("comb_pd_far", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="PD Far" />
        </div>
      </div>
      {!hideLabels && <span className="text-md font-medium pr-2 flex items-center justify-center w-6">C</span>}  
    </div>
  );
}

interface SubjectiveTabProps {
  subjectiveData: SubjectiveExam;
  onSubjectiveChange: (field: keyof SubjectiveExam, value: string) => void;
  isEditing: boolean;
  onVHConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  onMultifocalClick: () => void;
  hideEyeLabels?: boolean;
}

export function SubjectiveTab({
  subjectiveData,
  onSubjectiveChange,
  isEditing,
  onVHConfirm,
  onMultifocalClick,
  hideEyeLabels = false
}: SubjectiveTabProps) {
  return (
    <Card className="w-full shadow-md border-[1px] ">
      <CardContent className="px-4 pt-4 space-y-1">
        <div className="relative mb-4 pt-2">
          <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 px-2 font-medium text-muted-foreground">
              Subjective
          </div>
        </div>
        <SubjectiveSection eye="R" data={subjectiveData} onChange={onSubjectiveChange} isEditing={isEditing} hideLabels={hideEyeLabels} />
        <CombinedSubjFields subjectiveData={subjectiveData} onSubjectiveChange={onSubjectiveChange} isEditing={isEditing} onVHConfirm={onVHConfirm} onMultifocalClick={onMultifocalClick} hideLabels={hideEyeLabels} />
        <SubjectiveSection eye="L" data={subjectiveData} onChange={onSubjectiveChange} isEditing={isEditing} hideLabels={hideEyeLabels} />
      </CardContent>
    </Card>
  );
} 