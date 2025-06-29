import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdditionExam } from "@/lib/db/schema"

interface EyeSectionProps {
  eye: "R" | "L";
  data: AdditionExam;
  onChange: (field: keyof AdditionExam, value: string) => void;
  isEditing: boolean;
  hideLabels?: boolean;
}

function AdditionSection({ eye, data, onChange, isEditing, hideLabels = false }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  const getFieldValue = (field: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof AdditionExam;
    return data[eyeField]?.toString() || "";
  };

  const handleChange = (field: string, value: string) => {
    const eyeField = `${eye.toLowerCase()}_${field}` as keyof AdditionExam;
    onChange(eyeField, value);
  };

  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-7 gap-9 flex-1 w-full" dir="ltr">
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-fcc`} className="text-[12px] block text-center">FCC</Label>}
          <Input id={`${eye}-ad-fcc`} type="number" step="0.25" value={getFieldValue("fcc")} onChange={(e) => handleChange("fcc", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="FCC" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-read`} className="text-[12px] block text-center">READ</Label>}
          <Input id={`${eye}-ad-read`} type="number" step="0.25" value={getFieldValue("read")} onChange={(e) => handleChange("read", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="READ" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-int`} className="text-[12px] block text-center">INT</Label>}
          <Input id={`${eye}-ad-int`} type="number" step="0.25" value={getFieldValue("int")} onChange={(e) => handleChange("int", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="INT" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-bif`} className="text-[12px] block text-center">BIF</Label>}
          <Input id={`${eye}-ad-bif`} type="number" step="0.25" value={getFieldValue("bif")} onChange={(e) => handleChange("bif", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="BIF" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-mul`} className="text-[12px] block text-center">MUL</Label>}
          <Input id={`${eye}-ad-mul`} type="number" step="0.25" value={getFieldValue("mul")} onChange={(e) => handleChange("mul", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0.00" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-ad-j`} className="text-[12px] block text-center">J</Label>}
          <Input id={`${eye}-ad-j`} type="number" value={getFieldValue("j")} onChange={(e) => handleChange("j", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="0" />
        </div>
        <div>
          {eye === "R" && <Label htmlFor={`${eye}-iop`} className="text-[12px] block text-center">IOP</Label>}
          <Input id={`${eye}-iop`} type="number" step="0.1" value={getFieldValue("iop")} onChange={(e) => handleChange("iop", e.target.value)} disabled={!isEditing} className={`h-8 text-xs px-1 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`} placeholder="IOP" />
        </div>
      </div>
      {!hideLabels && <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-1" : "pt-4"}`}>{eyeLabel}</span>}
    </div>
  );
}

interface AdditionTabProps {
  additionData: AdditionExam;
  onAdditionChange: (field: keyof AdditionExam, value: string) => void;
  isEditing: boolean;
  hideEyeLabels?: boolean;
}

export function AdditionTab({
  additionData,
  onAdditionChange,
  isEditing,
  hideEyeLabels = false
}: AdditionTabProps) {
  return (
    <Card className="w-full shadow-md border-[1px] ">
      <CardContent className="px-4 pt-4 space-y-1">
        <div className="relative mb-1 pt-2">
          <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2  px-2 font-medium text-muted-foreground">
            Addition
          </div>
        </div>
        <AdditionSection eye="R" data={additionData} onChange={onAdditionChange} isEditing={isEditing} hideLabels={hideEyeLabels} />
        <AdditionSection eye="L" data={additionData} onChange={onAdditionChange} isEditing={isEditing} hideLabels={hideEyeLabels} />
      </CardContent>
    </Card>
  );
} 