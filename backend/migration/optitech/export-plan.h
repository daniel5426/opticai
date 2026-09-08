#pragma once

typedef struct {
  const char *table;
  const char *columns;
  const char *client_column;
} ExportPlan;

/* Table allowlist. Clinical tables preserve all columns across source versions;
 * identity, user, business and catalog tables retain explicit column allowlists. */
static const ExportPlan EXPORT_PLAN[] = {
  {"tblPerData", "PerId LastName FirstName TzId BirthDate Sex HomePhone WorkPhone CellPhone Fax Email Address CityId ZipCode DiscountId GroupId RefId UserId Comment RefsSub1Id RefsSub2Id WantsLaser LaserDate FamId MailList Ocup HidCom", "PerId"},
  {"tblUsers", "UserId LastName FirstName HomePhone CellPhone Fax Address ZipCode Diag Emp CityId BirthDate LevelId Comment UserTz PrivType", NULL},
  {"tblBases", "BaseId BaseName", NULL},
  {"tblCrdDisDiags", "PerId CheckDate PushUp MinusLens MonAccFac6 MonAccFac7 MonAccFac8 MonAccFac13 BinAccFac6 BinAccFac7 BinAccFac8 BinAccFac13 MEMRet FusedXCyl NRA PRA CoverDist CoverNear DistLatFor NearLatFor ACARatio SmverBo6M SmverBi6M SmverBo40CM SmverBi40CM StverBo7 StverBi7 StverBo6M StverBi6M StverBo40CM StverBi40CM JmpVer5 JmpVer8 AccTarget Penlight PenLightRG Summary UserId", "PerId"},
  {"tblCrdOverViews", "PerId CheckDate Comments VAR VAL UserId Pic", "PerId"},
  {"tblCrdOrthoks", "OrthokId PerId CheckDate ReCheckDate UserId rHR rHL rVR rVL AxHR AxHL rTR rTL rNR rNL rIR rIL rSR rSL DiamR DiamL BC1R BC1L OZR OZL SphR SphL FCR FCL ACR ACL AC2R AC2L SBR SBL EGR EGL FCRCT FCLCT ACRCT ACLCT AC2RCT AC2LCT MaterR MaterL TintR TintL VAR VAL ClensTypeIdR ClensTypeIdL ClensManufIdR ClensManufIdL ClensBrandIdR ClensBrandIdL ComR ComL PICL PICR OZRCT OZLCT OrderId CustId PupDiam CornDiam EyeLidKey CheckType", "PerId"},
  {"tblCrdClinicChecks", "ClinicCheckId PerId CheckDate", "PerId"},
  {"tblCrdClensFits", "PerId CheckDate FitId", "PerId"},
  {"tblCrdLVChecks", "PerId CheckDate LVId", "PerId"},
  {"tblCrdGlassChecksGlasses", "PerId CheckDate GlassId RoleId MaterId BrandId CoatId ModelId ColorId Diam Segment Com", "PerId"},
  {"tblCrdGlassChecksFrm", "PerId CheckDate GlassId FSapakId FLabelId FModel FColor FSize Comments", "PerId"},
  {"tblCrdGlassChecksGlassesP", "PerId CheckDate GlassPId", "PerId"},
  {"tblCrdFrps", "FrpId PerId ClensBrandId FrpDate TotalFrp ExchangeNum DayInterval Supply Comments SaleAdd", "PerId"},
  {"tblCrdFrpsLines", "FrpLineId FrpId LineDate Quantity", "@FrpId"},
  {"tblCrdGlassChecks", "PerId CheckDate UserId ReCheckDate FVR FVL SphR SphL CylR CylL AxR AxL PrisR PrisL BaseR BaseL VAR VAL VA PHR PHL ReadR ReadL AddBaseR AddBaseL AddPrisR AddPrisL IntR IntL BifR BifL MulR MulL HighR HighL PDDistR PDDistL PDReadR PDReadL DominEye IOPL IOPR ObjSphR ObjSphL ObjCylR ObjCylL ObjAxR ObjAxL ObjSphEsR ObjSphEsL ObjPD JR JL Comments ObjComm PDDistA PDReadA PFVR PFVL PSphR PSphL PCylR PCylL PAxR PAxL PPrisR PPrisL PBaseR PBaseL PVAR PVAL PVA PPHR PPHL PReadR PReadL PAddBaseR PAddBaseL PAddPrisR PAddPrisL PIntR PIntL PBifR PBifL PMulR PMulL PHighR PHighL PPDDistR PPDDistL PPDReadR PPDReadL PPDDistA PPDReadA PJR PJL CSR CSL ObjVAR ObjVAL ObjVA ObjAddR ObjAddL ObjJR ObjJL ExtPrisR ExtPrisL ExtBaseR ExtBaseL AddExtPrisR AddExtPrisL AddExtBaseR AddExtBaseL", "PerId"},
  {"tblCrdGlassChecksPrevs", "PerId CheckDate PrevId", "PerId"},
  {"tblCrdClensChecks", "PerId CheckDate UserId ReCheckDate PupDiam CornDiam EyeLidKey BUT ShirR ShirL Ecolor rHR rHL rVR rVL AxHR AxHL rTR rTL rNR rNL rIR rIL rSR rSL DiamR DiamL BC1R BC1L BC2R BC2L OZR OZL PrR PrL SphR SphL CylR CylL AxR AxL MaterR MaterL TintR TintL VAR VAL VA PHR PHL ClensTypeIdR ClensTypeIdL ClensManufIdR ClensManufIdL ClensBrandIdR ClensBrandIdL ClensSolCleanId ClensSolDisinfectId ClensSolRinseId Comments AddR AddL BUTL", "PerId"},
  {"tblCrdBuysWorks", "WorkId WorkDate PerId UserId WorkTypeId CheckDate WorkStatId WorkSupplyId LabId SapakId BagNum PromiseDate DeliverDate Comment FSapakId FLabelId FModel FColor FSize RoleId MaterId BrandId CoatId ModelId ColorId Diam Segment FrameSold Canceled", "PerId"},
  {"tblPerPicture", "PerPicId PerId PicFileName Description ScanDate Notes", "PerId"},
  {"tblCrdDiags", "PerId CheckDate UserId Complaints illnesses OptDiag DocRef Summary", "PerId"},
  {"tblClndrApt", "UserID AptDate AptNum StarTime EndTime AptDesc PerID TookPlace Reminder", "PerID"},
  {"tblClndrWrk", "WrkId UserID WrkDate StartTime EndTime WrkTime", NULL},
  {"tblCitys", "CityId CityName", NULL}, {"tblRefs", "RefId RefName", NULL},
  {"tblRefsSub1", "RefsSub1Id RefsSub1Name RefId", NULL}, {"tblRefsSub2", "RefsSub2Id RefsSub2Name RefsSub1Id", NULL},
  {"tblCrdGlassBrand", "GlassBrandId GlassBrandName", NULL}, {"tblCrdGlassCoat", "GlassCoatId GlassCoatName", NULL},
  {"tblCrdGlassColor", "GlassColorId GlassColorName", NULL}, {"tblCrdGlassMater", "GlassMaterId GlassMaterName", NULL},
  {"tblCrdGlassModel", "GlassModelId GlassModelName", NULL}, {"tblCrdGlassRole", "GlassRoleId GlassRoleName", NULL},
  {"tblCrdClensBrands", "ClensBrandId ClensBrandName", NULL}, {"tblCrdClensManuf", "ClensManufId ClensManufName", NULL},
  {"tblCrdClensTypes", "ClensTypeId ClensTypeName", NULL}, {"tblCrdClensSolClean", "ClensSolCleanId ClensSolCleanName", NULL},
  {"tblCrdClensSolDisinfect", "ClensSolDisinfectId ClensSolDisinfectName", NULL}, {"tblCrdClensSolRinse", "ClensSolRinseId ClensSolRinseName", NULL},
  {"tblCrdBuysWorkTypes", "WorkTypeId WorkTypeName", NULL}, {"tblCrdBuysWorkStats", "WorkStatId WorkStatName", NULL},
  {"tblCrdBuysWorkSupply", "WorkSupplyId WorkSupplyName", NULL}, {"tblCrdBuysWorkLabs", "LabID LabName", NULL},
  {"tblCrdBuysWorkSapaks", "SapakID SapakName", NULL}, {"tblCrdBuysWorkLabels", "LabelId LabelName", NULL},
  {"tblCrdClensChecksMater", "MaterId MaterName", NULL}, {"tblCrdClensChecksTint", "TintId TintName", NULL},
  {"tblCrdClensChecksPr", "PrId PrName", NULL},
  {"tblCrdGlassRetTypes", "RetTypeId RetTypeName", NULL}, {"tblCrdGlassRetDists", "RetDistId RetDistName", NULL},
  {"tblCrdGlassIOPInsts", "IOPInstId IOPInstName", NULL},
  {"tblCrdClinicChars", "EyeCheckCharId EyeCheckCharName EyeCheckCharType", NULL},
  {"tblCrdClinicFlds", "FldId FldName", NULL},
  {"tblCrdLVArea", "LVAreaId LVAreaName", NULL}, {"tblCrdLVFrame", "LVFrameId LVFrameName", NULL},
  {"tblCrdLVManuf", "LVManufId LVManufName", NULL}, {"tblCrdLVCap", "LVCapId LVCapName", NULL},
  {"tblCrdGlassUses", "GlassUseId GlassUseName", NULL}, {"tblEyes", "EyeId EyeName", NULL},
  {"tblLnsChars", "LensCharId LensCharName Fav", NULL}, {"tblLnsMaterials", "LensMaterId LensMaterName", NULL},
  {"tblLnsTreatChars", "TreatCharId TreatCharName", NULL}, {"tblLnsTypes", "LensTypeId LensTypeName", NULL},
  {"tblSapaks", "SapakID SapakName", NULL}, {NULL, NULL, NULL},
};

static const char *PREVIOUS_PREFIXES[] = {
  "SphR", "SphL", "CylR", "CylL", "AxR", "AxL", "PrisR", "PrisL", "BaseR", "BaseL", "VAR", "VAL", "VA", "AddR", "AddL", "PDDistR", "PDDistL", "PDDistA", "ExtPrisR", "ExtPrisL", "ExtBaseR", "ExtBaseL", "Comments", NULL,
};

static const char *CLINICAL_TABLES[] = { "tblCrdGlassChecks", "tblCrdGlassChecksPrevs", "tblCrdClensChecks", "tblCrdDisDiags", "tblCrdOverViews", "tblCrdOrthoks", "tblCrdClinicChecks", "tblCrdClensFits", "tblCrdLVChecks", "tblCrdGlassChecksGlasses", "tblCrdGlassChecksFrm", "tblCrdGlassChecksGlassesP", "tblCrdFrps", "tblCrdFrpsLines", NULL };
static const char *LOOKUP_TABLES[] = {
  "tblBases", "tblCitys", "tblRefs", "tblRefsSub1", "tblRefsSub2",
  "tblCrdGlassBrand", "tblCrdGlassCoat", "tblCrdGlassColor", "tblCrdGlassMater", "tblCrdGlassModel", "tblCrdGlassRole",
  "tblCrdClensBrands", "tblCrdClensManuf", "tblCrdClensTypes", "tblCrdClensSolClean", "tblCrdClensSolDisinfect", "tblCrdClensSolRinse",
  "tblCrdBuysWorkTypes", "tblCrdBuysWorkStats", "tblCrdBuysWorkSupply", "tblCrdBuysWorkLabs", "tblCrdBuysWorkSapaks", "tblCrdBuysWorkLabels",
  "tblCrdClensChecksMater", "tblCrdClensChecksTint", "tblCrdClensChecksPr",
  "tblCrdGlassRetTypes", "tblCrdGlassRetDists", "tblCrdGlassIOPInsts", "tblCrdClinicChars", "tblCrdClinicFlds",
  "tblCrdLVArea", "tblCrdLVFrame", "tblCrdLVManuf", "tblCrdLVCap", "tblCrdGlassUses", "tblEyes",
  "tblLnsChars", "tblLnsMaterials", "tblLnsTreatChars", "tblLnsTypes", "tblSapaks", NULL
};
