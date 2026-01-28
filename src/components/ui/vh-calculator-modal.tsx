import React from "react";
import { useState } from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

interface VHCalculatorModalProps {
  onConfirm: (rightPris: number, rightBase: number, leftPris: number, leftBase: number) => void;
  onRawConfirm?: (rightPrisH: number, rightBaseH: string, rightPrisV: number, rightBaseV: string, leftPrisH: number, leftBaseH: string, leftPrisV: number, leftBaseV: string) => void;
  disabled?: boolean;
}

export function VHCalculatorModal({ onConfirm, onRawConfirm, disabled = false }: VHCalculatorModalProps) {
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
    if (onRawConfirm) {
      onRawConfirm(rightPrisH, rightBaseH, rightPrisV, rightBaseV, leftPrisH, leftBaseH, leftPrisV, leftBaseV);
    } else {
      onConfirm(rightResult.pris, rightResult.base, leftResult.pris, leftResult.base);
    }
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={`h-8 shadow-none text-xs px-2`} type="button" disabled={disabled}>
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
                  className="h-9 pr-1 text-sm px-2 text-right" 
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
                  className="h-9 pr-1 text-sm px-2 text-right" 
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
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center  font-medium">
                  {rightResult.pris}
                </div>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center  font-medium">
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
                  className="h-9 pr-1 text-sm px-2 text-right" 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={leftBaseH} onValueChange={setLeftBaseH}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px]" >
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
                  className="h-9 pr-1 text-sm px-2 text-right " 
                  dir="rtl"
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <Select value={leftBaseV} onValueChange={setLeftBaseV}>
                  <SelectTrigger className="h-9 text-sm w-full min-w-[60px] ">
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
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center font-medium">
                  {leftResult.pris}
                </div>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-9 text-sm px-2 border rounded flex items-center justify-center font-medium">
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