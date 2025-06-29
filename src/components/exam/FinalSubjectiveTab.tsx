import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FinalSubjectiveExam } from "@/lib/db/schema"
import { toast } from "sonner"

interface EyeSectionProps {
  eye: "R" | "L";
  data: FinalSubjectiveExam;
  onChange: (field: keyof FinalSubjectiveExam, value: string) => void;
  isEditing: boolean;
  hideLabels?: boolean;
}

function FinalSubjectiveSection({ eye, data, onChange, isEditing, hideLabels = false }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  const getFieldValue = (field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof FinalSubjectiveExam;
    return data[eyeField]?.toString() || "";
  };

  const handleChange = (field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof FinalSubjectiveExam;
    onChange(eyeField, value);
  };

  return (
    <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
      <div className="grid grid-cols-22 gap-4 flex-1 pb-2 w-full" dir="ltr">
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-sph`} className="text-[12px] block text-center">SPH</Label>}
          <Input id={`${eye}-final-sph`} type="number" step="0.25" value={getFieldValue("sph")} onChange={(e) => handleChange("sph", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-cyl`} className="text-[12px] block text-center">CYL</Label>}
          <Input id={`${eye}-final-cyl`} type="number" step="0.25" value={getFieldValue("cyl")} onChange={(e) => handleChange("cyl", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-ax`} className="text-[12px] block text-center">AXIS</Label>}
          <Input id={`${eye}-final-ax`} type="number" min="0" max="180" value={getFieldValue("ax")} onChange={(e) => handleChange("ax", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-pr-h`} className="text-[12px] block text-center">PR.H</Label>}
          <Input id={`${eye}-final-pr-h`} type="number" step="0.5" value={getFieldValue("pr_h")} onChange={(e) => handleChange("pr_h", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-base-h`} className="text-[12px] block text-center">BASE.H</Label>}
          <Select value={getFieldValue("base_h")} onValueChange={(value) => handleChange("base_h", value)} disabled={!isEditing}>
            <SelectTrigger className={`h-8 text-xs w-full ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100`}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IN">IN</SelectItem>
              <SelectItem value="OUT">OUT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-pr-v`} className="text-[12px] block text-center">PR.V</Label>}
          <Input id={`${eye}-final-pr-v`} type="number" step="0.5" value={getFieldValue("pr_v")} onChange={(e) => handleChange("pr_v", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-base-v`} className="text-[12px] block text-center">BASE.V</Label>}
          <Select value={getFieldValue("base_v")} onValueChange={(value) => handleChange("base_v", value)} disabled={!isEditing}>
            <SelectTrigger className={`h-8 text-xs w-full ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100`}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UP">UP</SelectItem>
              <SelectItem value="DOWN">DOWN</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-va`} className="text-[12px] block text-center">VA</Label>}
          <div className="relative" dir="ltr">
            <Input id={`${eye}-final-va`} type="number" step="0.1" value={getFieldValue("va")} onChange={(e) => handleChange("va", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-j`} className="text-[12px] block text-center">J</Label>}
          <Input id={`${eye}-final-j`} type="number" value={getFieldValue("j")} onChange={(e) => handleChange("j", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-pd-close`} className="text-[12px] block text-center">PD CLOSE</Label>}
          <Input id={`${eye}-final-pd-close`} type="number" step="0.5" value={getFieldValue("pd_close")} onChange={(e) => handleChange("pd_close", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="PD" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-final-pd-far`} className="text-[12px] block text-center">PD FAR</Label>}
          <Input id={`${eye}-final-pd-far`} type="number" step="0.5" value={getFieldValue("pd_far")} onChange={(e) => handleChange("pd_far", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="PD" />
        </div>
      </div>
      {!hideLabels && <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-2" : "pt-2"}`}>{eyeLabel}</span>}
    </div>
  );
}

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

function CombinedFinalSubjFields({ finalSubjectiveData, onChange, isEditing, onVHConfirm, hideLabels = false }: { 
  finalSubjectiveData: FinalSubjectiveExam, 
  onChange: (field: keyof FinalSubjectiveExam, value: string) => void, 
  isEditing: boolean,
  onVHConfirm: (rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string, leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string) => void,
  hideLabels?: boolean
}) {
  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-22 gap-4 flex-1 w-full" dir="ltr">
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2 flex justify-center items-center">
          <VHCalculatorModal onConfirm={onVHConfirm} disabled={!isEditing} />
        </div>
        <div className="col-span-2">
        <div className="relative" dir="ltr">
            <Input id={`comb-final-va`} type="number" step="0.1" value={finalSubjectiveData.comb_va?.toString() || ""} onChange={(e) => onChange("comb_va", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 pl-6 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.0" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2"></div>
        <div className="col-span-2">
          <Input type="number" step="0.5" value={finalSubjectiveData.comb_pd_close?.toString() || ""} onChange={(e) => onChange("comb_pd_close", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="PD Close" />
        </div>
        <div className="col-span-2">
          <Input type="number" step="0.5" value={finalSubjectiveData.comb_pd_far?.toString() || ""} onChange={(e) => onChange("comb_pd_far", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="PD Far" />
        </div>
      </div>
      {!hideLabels && <span className="text-md font-medium pr-2 flex items-center justify-center w-6">C</span>}  
    </div>
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
  return (
    <Card className="w-full shadow-md border-[1px] ">
      <CardContent className="px-4 pt-4 space-y-1">
        <div className="relative mb-4 pt-2">
          <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 px-2 font-medium text-muted-foreground">
            Final Subjective
          </div>
        </div>
        <FinalSubjectiveSection eye="R" data={finalSubjectiveData} onChange={onFinalSubjectiveChange} isEditing={isEditing} hideLabels={hideEyeLabels} />
        <CombinedFinalSubjFields finalSubjectiveData={finalSubjectiveData} onChange={onFinalSubjectiveChange} isEditing={isEditing} onVHConfirm={onVHConfirm} hideLabels={hideEyeLabels} />
        <FinalSubjectiveSection eye="L" data={finalSubjectiveData} onChange={onFinalSubjectiveChange} isEditing={isEditing} hideLabels={hideEyeLabels} />
      </CardContent>
    </Card>
  );
} 