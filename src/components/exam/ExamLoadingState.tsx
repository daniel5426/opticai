import React from "react";
import { SiteHeader } from "@/components/site-header";
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

interface ExamLoadingStateProps {
    activeTab: string;
    onTabChange: (value: string) => void;
}

export function ExamLoadingState({ activeTab, onTabChange }: ExamLoadingStateProps) {
    return (
        <>
            <SiteHeader
                title="לקוחות"
                backLink="/clients"
                tabs={{ activeTab, onTabChange }}
            />
            <ClientSpaceLayout>
                <div
                    className="no-scrollbar mb-10 flex flex-1 flex-col p-4 lg:p-5"
                    dir="rtl"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                    <div className="mb-6">
                        <Card className="w-full examcard rounded-xl px-4 py-3 bg-background">
                            <div
                                className="flex items-center gap-2 w-full whitespace-nowrap overflow-x-auto no-scrollbar"
                                dir="rtl"
                                style={{ scrollbarWidth: "none" }}
                            >
                                <div className="min-w-[100px] max-w-[180px] w-full flex-1 sm:w-[180px]">
                                    <Skeleton className="h-9 w-full rounded-lg" />
                                </div>

                                <div className="min-w-[80px] max-w-[120px] w-full flex-1 sm:w-[120px]">
                                    <Skeleton className="h-9 w-full rounded-lg" />
                                </div>

                                <div className="flex flex-col min-w-[100px] max-w-[180px] w-full flex-1 sm:w-[180px]">
                                    <Skeleton className="h-9 w-full rounded-lg" />
                                </div>
                                <div className="flex flex-col min-w-[80px] max-w-[120px] w-full flex-1 sm:w-[120px]">
                                    <Skeleton className="h-9 w-full rounded-lg" />
                                </div>
                                <div className="flex-1" />
                                <div className="flex items-center gap-2 min-w-0">
                                    <Skeleton className="h-9 min-w-[56px] w-1/3 max-w-[96px] rounded-lg" />
                                    <Skeleton className="h-9 min-w-[56px] w-1/3 max-w-[96px] rounded-lg" />
                                    <Skeleton className="h-9 min-w-[32px] w-1/5 max-w-[40px] rounded-lg" />
                                </div>
                            </div>
                        </Card>
                    </div>
                    <div className="mb-6 flex items-center gap-2">
                        <Skeleton className="h-10 w-20 rounded-xl" />
                        <Skeleton className="h-10 w-24 rounded-xl" />
                        <Skeleton className="h-10 w-28 rounded-xl" />
                    </div>
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="w-full">
                                <div className="flex gap-4" dir="ltr">
                                    <Skeleton className="h-40 w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </ClientSpaceLayout>
        </>
    );
}

interface ExamNotFoundStateProps {
    activeTab: string;
    onTabChange: (value: string) => void;
}

export function ExamNotFoundState({ activeTab, onTabChange }: ExamNotFoundStateProps) {
    return (
        <>
            <SiteHeader
                title="לקוחות"
                backLink="/clients"
                tabs={{ activeTab, onTabChange }}
            />
            <ClientSpaceLayout>
                <div className="flex h-full flex-col items-center justify-center">
                    <h1 className="text-2xl">בדיקה לא נמצאה</h1>
                </div>
            </ClientSpaceLayout>
        </>
    );
}
