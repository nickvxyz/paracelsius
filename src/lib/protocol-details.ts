export interface ProtocolDetail {
  summary: string;
  mechanisms: string[];
  targets?: string[];
  interventions?: string[];
  timeline?: string[];
  insight?: string;
}

export const PROTOCOL_DETAILS: Record<string, ProtocolDetail> = {
  biomarkers: {
    summary: "System-wide failure detection. Biomarkers are early signals of organ dysfunction before disease manifests. Highest leverage layer — most chronic diseases are detectable and reversible years earlier.",
    mechanisms: [
      "High glucose \u2192 glycation \u2192 vascular damage",
      "Inflammation \u2192 endothelial dysfunction",
      "Lipids \u2192 plaque formation",
    ],
    targets: [
      "HbA1c: 4.8\u20135.3% (>5.7 = prediabetes)",
      "Fasting insulin: 2\u20136 \u00b5IU/mL",
      "Triglycerides: <80 mg/dL",
      "ApoB: 20\u201360 mg/dL",
      "Lp(a): <30 mg/dL (genetic)",
      "NT-proBNP: <100 pg/mL",
      "hs-CRP: <1.0 mg/L (>3 = high risk)",
      "Cystatin C: 0.6\u20131.0 mg/L",
      "ALT: <25 U/L",
      "Hemoglobin (men): 13.5\u201317.5 g/dL",
      "RDW: <13%",
      "WBC: 4\u20137 x10\u2079/L",
      "NLR: <2",
      "FEV1/FVC: >80% predicted",
      "CGM post-meal glucose: <140 mg/dL",
    ],
    insight: "If biomarkers are not optimal \u2192 everything else is secondary.",
  },

  smoking: {
    summary: "There is no safe smoking. No safe device.",
    mechanisms: [
      "Direct DNA mutation",
      "Oxidative stress",
      "Vascular damage",
    ],
    targets: [
      "Harm ranking (worst \u2192 least): combustible cigarettes \u2192 cigars/pipes \u2192 hookah \u2192 vaping \u2192 heated tobacco \u2192 nicotine replacement \u2192 no exposure",
    ],
    timeline: [
      "2 weeks: lung recovery begins",
      "1 year: CVD risk \u221250%",
      "10\u201315 years: cancer risk normalises",
    ],
  },

  mental_health: {
    summary: "Chronic stress is biological damage, not psychological inconvenience.",
    mechanisms: [
      "Cortisol elevation",
      "Systemic inflammation",
      "Sleep disruption",
      "Behavioural collapse",
    ],
    targets: [
      "High-risk states: depression, anxiety, isolation",
    ],
    interventions: [
      "CBT (cognitive behavioural therapy)",
      "Medication where appropriate",
      "Structured daily routine",
      "Social integration",
    ],
  },

  exercise: {
    summary: "VO2max is one of the strongest predictors of survival.",
    mechanisms: [
      "Improves mitochondrial function",
      "Reduces insulin resistance",
      "Increases cardiac capacity",
    ],
    targets: [
      "6+ hours/week moderate or vigorous",
      "Max 3 vigorous sessions",
      "6,000+ daily steps",
      "VO2max: top percentile for age",
    ],
  },

  calories: {
    summary: "Caloric restriction reduces metabolic stress and inflammation.",
    mechanisms: [
      "Reduced metabolic stress",
      "Lower insulin levels",
      "Reduced systemic inflammation",
    ],
    targets: [
      "10\u201320% below energy needs",
    ],
    insight: "Over-restriction \u2192 muscle loss \u2192 worse outcomes. Balance is critical.",
  },

  diet: {
    summary: "AHEI-2010 diet improves lipid profile, reduces inflammation, stabilises glucose.",
    mechanisms: [
      "Improves lipid profile",
      "Reduces inflammation",
      "Stabilises glucose",
    ],
    targets: [
      "High intake: vegetables, fruits, whole grains, nuts, legumes, omega-3",
      "Low intake: processed meat, sugar, sodium, trans fats",
    ],
  },

  bmi: {
    summary: "Body fat distribution matters more than weight.",
    mechanisms: [
      "Visceral fat \u2192 inflammation \u2192 metabolic syndrome",
      "Excess weight \u2192 insulin resistance",
    ],
    targets: [
      "BMI: 18.5\u201322.5",
      "Body fat \u2014 men: ~15%, women: ~20%",
      "Waist < hips",
    ],
    insight: "Body fat distribution matters more than total weight.",
  },

  apob: {
    summary: "ApoB measures the number of atherogenic particles \u2014 the direct driver of arterial plaque.",
    mechanisms: [
      "ApoB particles \u2192 arterial plaque \u2192 heart disease",
    ],
    targets: [
      "Optimal: 20\u201360 mg/dL",
    ],
    interventions: [
      "Diet modification",
      "Statins if needed",
    ],
  },

  blood_pressure: {
    summary: "High pressure causes direct vascular damage leading to stroke and heart attack.",
    mechanisms: [
      "Vascular damage",
      "Stroke risk",
      "Heart attack risk",
    ],
    targets: [
      "Optimal: <115/70",
    ],
    interventions: [
      "Weight loss",
      "Salt reduction",
      "Exercise",
    ],
  },

  hormones: {
    summary: "Hormones maintain muscle, bone density, and cognitive function.",
    mechanisms: [
      "Muscle maintenance",
      "Bone density",
      "Cognitive function",
    ],
    targets: [
      "Men \u2014 free testosterone: 0.4\u20130.6 nmol/L",
      "Women \u2014 HRT post menopause (context dependent)",
    ],
  },

  screening: {
    summary: "Detection shifts disease from fatal to manageable.",
    mechanisms: [
      "Early detection \u2192 early intervention",
      "Cancer caught at stage 1 vs stage 4 = survival difference of decades",
    ],
    targets: [
      "Colonoscopy",
      "Mammogram",
      "PSA",
      "Lipids panel",
      "HbA1c",
      "Eye exam",
      "Dental screening",
    ],
  },

  sleep: {
    summary: "Sleep regulates hormones, clears brain toxins, and stabilises metabolism.",
    mechanisms: [
      "Hormone regulation",
      "Brain detox (glymphatic system)",
      "Metabolic stability",
    ],
    targets: [
      "7\u20138 hours per night",
      "Consistent timing",
      "High sleep efficiency",
      "Minimal awakenings",
      "Subjective quality: restful",
    ],
  },

  vitamins: {
    summary: "Vitamin deficiencies impair immune function, bone health, and neurological stability.",
    mechanisms: [
      "Immune function",
      "Bone health",
      "Neurological stability",
    ],
    targets: [
      "Vitamin D: 75\u2013125 nmol/L",
      "B12: 400\u2013700 pg/mL",
      "Folate: mid reference range",
    ],
  },

  social: {
    summary: "Strong relationships increase survival by ~50%.",
    mechanisms: [
      "Reduced stress response",
      "Behaviour regulation",
      "Psychological stability",
    ],
  },

  air_quality: {
    summary: "Air pollution causes lung inflammation and cardiovascular stress.",
    mechanisms: [
      "Lung inflammation",
      "Cardiovascular stress",
    ],
    targets: [
      "PM2.5: <12 \u00b5g/m\u00b3",
    ],
    interventions: [
      "Air purifier at home",
      "Avoid high-traffic areas",
      "Monitor local AQI",
    ],
  },

  oral_health: {
    summary: "Periodontal disease causes systemic inflammation \u2014 bacteria enter the bloodstream and damage vessels.",
    mechanisms: [
      "Bacteria enter bloodstream \u2192 vascular damage",
      "Chronic oral inflammation \u2192 systemic inflammation",
    ],
    interventions: [
      "Daily brushing and flossing",
      "Professional cleaning 2x/year",
    ],
  },

  alcohol: {
    summary: "No safe level of alcohol (WHO). Any amount causes DNA damage and increases cancer risk.",
    mechanisms: [
      "DNA damage",
      "Cancer risk elevation",
      "Liver toxicity",
    ],
    targets: [
      "Risk gradient: heavy > binge > moderate > light > none",
    ],
    timeline: [
      "Days: liver recovery starts",
      "Months: metabolic normalisation",
    ],
  },
};
