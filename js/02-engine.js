// ════════════════════════════════════════════════════════
// CALCULATION ENGINE  — pure JS, no AI involvement
// ════════════════════════════════════════════════════════
const WACC         = 0.12;   // 12% = RFR 7% (10Y GOI bond) + ERP 5%
const TERMINAL_G   = 0.055;  // 5.5% = India long-run GDP + CPI
const MOS          = 0.10;   // 10% margin of safety on DCF

// ════════════════════════════════════════════════════════
// SECTOR CONFIGURATIONS — sector-aware metrics, checklist & scoring
// ════════════════════════════════════════════════════════
const SECTOR_CONFIGS = {
  BANKING_NBFC: {
    name:'Banking & NBFC', icon:'🏦', color:'#1565c0', wacc:0.13,
    note:'For banks, D/E is not meaningful — banks are inherently leveraged. Key metrics: NIM, NPA quality, CASA, CAR, ROA. Use P/B and P/ABV for valuation, not P/E DCF.',
    metrics:[
      {id:'nim_pct',           lbl:'Net Interest Margin (NIM)',   unit:'%', hi:true,  lo:2,  hi_v:5,  desc:'Higher NIM = wider spread'},
      {id:'gross_npa_pct',     lbl:'Gross NPA',                   unit:'%', hi:false, lo:0,  hi_v:6,  desc:'<3% preferred'},
      {id:'net_npa_pct',       lbl:'Net NPA',                     unit:'%', hi:false, lo:0,  hi_v:2,  desc:'<1% = healthy'},
      {id:'casa_ratio_pct',    lbl:'CASA Ratio',                  unit:'%', hi:true,  lo:25, hi_v:55, desc:'>40% = low-cost funds'},
      {id:'car_pct',           lbl:'Capital Adequacy (CAR)',       unit:'%', hi:true,  lo:12, hi_v:20, desc:'Regulatory min 11.5%'},
      {id:'roa_pct',           lbl:'Return on Assets (ROA)',       unit:'%', hi:true,  lo:0.5,hi_v:2.5,desc:'>1.5% = efficient'},
      {id:'credit_cost_pct',   lbl:'Credit Cost',                  unit:'%', hi:false, lo:0,  hi_v:2,  desc:'<1% = low risk'},
      {id:'loan_growth_pct',   lbl:'Loan Book Growth',             unit:'%', hi:true,  lo:5,  hi_v:30, desc:'>15% = healthy'},
      {id:'pcr_pct',           lbl:'Provision Coverage (PCR)',     unit:'%', hi:true,  lo:50, hi_v:90, desc:'>70% = well covered'},
      {id:'cost_income_pct',   lbl:'Cost-to-Income Ratio',         unit:'%', hi:false, lo:30, hi_v:65, desc:'<45% = efficient'},
    ],
    checklist:[
      {lbl:'NIM > 3.0%',                   fn:d=>(d.sd?.nim_pct||0)>3,                         sub:d=>`NIM: ${pct(d.sd?.nim_pct)}`},
      {lbl:'Gross NPA < 3%',               fn:d=>(d.sd?.gross_npa_pct||99)<3,                  sub:d=>`GNPA: ${pct(d.sd?.gross_npa_pct)}`},
      {lbl:'Net NPA < 1%',                 fn:d=>(d.sd?.net_npa_pct||99)<1,                    sub:d=>`NNPA: ${pct(d.sd?.net_npa_pct)}`},
      {lbl:'CASA Ratio > 40%',             fn:d=>(d.sd?.casa_ratio_pct||0)>40,                 sub:d=>`CASA: ${pct(d.sd?.casa_ratio_pct)}`},
      {lbl:'CAR > 15%',                    fn:d=>(d.sd?.car_pct||0)>15,                        sub:d=>`CAR: ${pct(d.sd?.car_pct)}`},
      {lbl:'ROA > 1.5%',                   fn:d=>(d.sd?.roa_pct||0)>1.5,                       sub:d=>`ROA: ${pct(d.sd?.roa_pct)}`},
      {lbl:'Credit Cost < 1%',             fn:d=>(d.sd?.credit_cost_pct||99)<1,                sub:d=>`Cr. Cost: ${pct(d.sd?.credit_cost_pct)}`},
      {lbl:'Loan Growth > 15%',            fn:d=>(d.sd?.loan_growth_pct||0)>15,                sub:d=>`Growth: ${pct(d.sd?.loan_growth_pct)}`},
      {lbl:'Provision Coverage > 70%',     fn:d=>(d.sd?.pcr_pct||0)>70,                       sub:d=>`PCR: ${pct(d.sd?.pcr_pct)}`},
      {lbl:'Cost-to-Income < 45%',         fn:d=>(d.sd?.cost_income_pct||99)<45,               sub:d=>`C/I: ${pct(d.sd?.cost_income_pct)}`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(sd.nim_pct,2,5),si(sd.gross_npa_pct,0,6),s(sd.roa_pct,0.5,2.5),s(sd.casa_ratio_pct,25,55),s(sd.loan_growth_pct,5,30),si(sd.cost_income_pct,30,65),s(d.roe_pct,10,25),s(d.revenue_cagr_3yr_pct,5,30)]; },
    growthReg:0.50, maxGrowthCap:0.28,
  },
  IT_SERVICES: {
    name:'IT Services', icon:'💻', color:'#1565c0', wacc:0.11,
    note:'IT services are capex-light and cash-generative. EBIT margin (not EBITDA) is key — no depreciation from factories. Attrition and deal pipeline are leading indicators. Currency hedging impacts margins.',
    metrics:[
      {id:'ebit_margin_pct',      lbl:'EBIT Margin',             unit:'%', hi:true,  lo:15, hi_v:35, desc:'>20% = excellent'},
      {id:'attrition_rate_pct',   lbl:'Attrition Rate',          unit:'%', hi:false, lo:5,  hi_v:25, desc:'<15% = stable talent'},
      {id:'utilization_rate_pct', lbl:'Utilization Rate',        unit:'%', hi:true,  lo:70, hi_v:90, desc:'>80% = efficient'},
      {id:'deal_tcv_cr',          lbl:'Deal TCV Won (Cr)',        unit:' Cr',hi:true, lo:0,  hi_v:10000,desc:'Growing TCV = revenue visibility'},
      {id:'revenue_per_emp_lakh', lbl:'Revenue / Employee (L)',  unit:'L', hi:true,  lo:10, hi_v:50, desc:'Higher = better productivity'},
      {id:'headcount_growth_pct', lbl:'Headcount Growth',        unit:'%', hi:true,  lo:0,  hi_v:15, desc:'Signals demand confidence'},
      {id:'fcf_conversion_pct',   lbl:'FCF Conversion',          unit:'%', hi:true,  lo:60, hi_v:100,desc:'>80% = excellent cash quality'},
      {id:'us_revenue_pct',       lbl:'US Revenue Mix',          unit:'%', hi:false, lo:30, hi_v:80, desc:'High = forex & VISA risk'},
    ],
    checklist:[
      {lbl:'Revenue CAGR > 12% (USD)',      fn:d=>(d.revenue_cagr_3yr_pct||0)>12,              sub:d=>`CAGR: ${pct(d.revenue_cagr_3yr_pct)}`},
      {lbl:'EBIT Margin > 20%',             fn:d=>(d.sd?.ebit_margin_pct||0)>20,               sub:d=>`EBIT Margin: ${pct(d.sd?.ebit_margin_pct)}`},
      {lbl:'Attrition Rate < 15%',          fn:d=>(d.sd?.attrition_rate_pct||99)<15,           sub:d=>`Attrition: ${pct(d.sd?.attrition_rate_pct)}`},
      {lbl:'Deal TCV Growing YoY',          fn:d=>!!(d.sd?.deal_wins_growing),                  sub:_=>'Qualitative'},
      {lbl:'Utilization Rate > 80%',        fn:d=>(d.sd?.utilization_rate_pct||0)>80,           sub:d=>`Util: ${pct(d.sd?.utilization_rate_pct)}`},
      {lbl:'FCF Conversion > 80%',          fn:d=>(d.sd?.fcf_conversion_pct||0)>80,             sub:d=>`FCF Conv: ${pct(d.sd?.fcf_conversion_pct)}`},
      {lbl:'Debt-Free (D/E < 0.1)',         fn:d=>(d.debt_to_equity||1)<0.1,                   sub:d=>`D/E: ${d.debt_to_equity?.toFixed(2)||'N/A'}`},
      {lbl:'ROE > 25%',                     fn:d=>(d.roe_pct||0)>25,                           sub:d=>`ROE: ${pct(d.roe_pct)}`},
      {lbl:'Management Quality > 70',       fn:d=>(d.management_track_record_score||0)>70,      sub:d=>`Score: ${d.management_track_record_score||'N/A'}/100`},
      {lbl:'Digital Transformation Tailwind',fn:d=>(d.sector_tailwind_score||0)>65,            sub:d=>`Score: ${d.sector_tailwind_score||'N/A'}/100`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,5,30),s(sd.ebit_margin_pct,15,35),si(sd.attrition_rate_pct,5,25),s(sd.utilization_rate_pct,70,90),s(d.roe_pct,15,40),s(sd.fcf_conversion_pct,60,100),si(d.debt_to_equity,0,1),s(d.profit_cagr_3yr_pct,5,40)]; },
    growthReg:0.55, maxGrowthCap:0.30,
  },
  MANUFACTURING: {
    name:'Manufacturing', icon:'🏭', color:'#37474f', wacc:0.12,
    note:'Manufacturing companies benefit from operating leverage — utilization drives margins. Track capacity expansion timeline vs demand cycle. Working capital efficiency separates great from average manufacturers.',
    metrics:[
      {id:'capacity_util_pct',    lbl:'Capacity Utilization',    unit:'%', hi:true,  lo:60, hi_v:95, desc:'>80% = operating leverage kicks in'},
      {id:'asset_turnover',       lbl:'Asset Turnover',          unit:'x', hi:true,  lo:0.5,hi_v:3,  desc:'Higher = efficient asset use'},
      {id:'inventory_days',       lbl:'Inventory Days',          unit:'d', hi:false, lo:15, hi_v:90, desc:'<45 days = lean operations'},
      {id:'debtor_days',          lbl:'Debtor Days',             unit:'d', hi:false, lo:15, hi_v:90, desc:'<45 days preferred'},
      {id:'working_capital_days', lbl:'Working Capital Days',    unit:'d', hi:false, lo:20, hi_v:120,desc:'<60 days = efficient'},
      {id:'capex_to_rev_pct',     lbl:'Capex / Revenue',         unit:'%', hi:false, lo:2,  hi_v:20, desc:'Track if growth or maintenance'},
      {id:'gross_margin_pct',     lbl:'Gross Margin',            unit:'%', hi:true,  lo:20, hi_v:60, desc:'Pricing power indicator'},
      {id:'order_backlog_months', lbl:'Order Backlog',           unit:'M', hi:true,  lo:2,  hi_v:18, desc:'Revenue visibility'},
    ],
    checklist:[
      {lbl:'Revenue CAGR > 15%',            fn:d=>(d.revenue_cagr_3yr_pct||0)>15,              sub:d=>`CAGR: ${pct(d.revenue_cagr_3yr_pct)}`},
      {lbl:'PAT CAGR > 20%',                fn:d=>(d.profit_cagr_3yr_pct||0)>20,               sub:d=>`CAGR: ${pct(d.profit_cagr_3yr_pct)}`},
      {lbl:'Capacity Utilization > 75%',    fn:d=>(d.sd?.capacity_util_pct||0)>75,             sub:d=>`Util: ${pct(d.sd?.capacity_util_pct)}`},
      {lbl:'Debt / Equity < 0.8x',          fn:d=>(d.debt_to_equity||99)<0.8,                  sub:d=>`D/E: ${d.debt_to_equity?.toFixed(2)||'N/A'}`},
      {lbl:'ROE & ROCE > 20%',              fn:d=>(d.roe_pct||0)>20&&(d.roce_pct||0)>20,      sub:d=>`ROE: ${pct(d.roe_pct)} ROCE: ${pct(d.roce_pct)}`},
      {lbl:'Working Capital < 60 Days',     fn:d=>(d.sd?.working_capital_days||99)<60,          sub:d=>`WC: ${d.sd?.working_capital_days||'N/A'}d`},
      {lbl:'Margin Expansion Scope',        fn:d=>!!(d.margin_expansion_potential),             sub:_=>'Qualitative'},
      {lbl:'Strong Order Book / Backlog',   fn:d=>d.business_overview?.order_book!=null,        sub:_=>'Order book disclosed'},
      {lbl:'PLI / Govt Scheme Beneficiary', fn:d=>(d.government_support_score||0)>65,          sub:d=>`Score: ${d.government_support_score||'N/A'}/100`},
      {lbl:'Promoter Hold > 50%, Pledge < 5%',fn:d=>(d.promoter_holding_pct||0)>50&&(d.promoter_pledge_pct||99)<5, sub:d=>`Hold: ${pct(d.promoter_holding_pct)}`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,5,40),s(d.profit_cagr_3yr_pct,5,50),s(d.roe_pct,10,35),s(d.roce_pct,12,40),s(d.operating_margin_pct,8,30),si(d.debt_to_equity,0,2),s(sd.capacity_util_pct,60,95),si(sd.working_capital_days,20,120)]; },
    growthReg:0.55, maxGrowthCap:0.35,
  },
  MINING_METALS: {
    name:'Mining & Metals', icon:'⛏️', color:'#4e342e', wacc:0.13,
    note:'Mining is cyclical — commodity prices dominate earnings. EV/EBITDA and reserve life are primary metrics. D/E is less informative; Net Debt/EBITDA is the correct leverage metric. High margins during up-cycles must fund debt repayment.',
    metrics:[
      {id:'production_growth_pct',lbl:'Production Volume Growth',unit:'%', hi:true,  lo:0,  hi_v:20, desc:'Organic growth driver'},
      {id:'capacity_util_pct',    lbl:'Capacity Utilization',    unit:'%', hi:true,  lo:60, hi_v:95, desc:'>75% = good output'},
      {id:'net_debt_ebitda',      lbl:'Net Debt / EBITDA',       unit:'x', hi:false, lo:0,  hi_v:4,  desc:'<2x = manageable'},
      {id:'reserve_life_years',   lbl:'Reserve Life',            unit:'yr',hi:true,  lo:8,  hi_v:40, desc:'>15 yrs = long runway'},
      {id:'realization_per_tonne',lbl:'Realization / Tonne (₹)', unit:'₹', hi:true,  lo:0,  hi_v:100000,desc:'Revenue per unit'},
      {id:'stripping_ratio',      lbl:'Stripping Ratio',         unit:'x', hi:false, lo:1,  hi_v:8,  desc:'Lower = cheaper mining'},
    ],
    checklist:[
      {lbl:'EBITDA Margin > 25%',           fn:d=>(d.operating_margin_pct||0)>25,              sub:d=>`Margin: ${pct(d.operating_margin_pct)}`},
      {lbl:'EV/EBITDA < Sector Avg',        fn:d=>(d.ev_ebitda||99)<(d.sector_ev_ebitda_avg||25)*0.9, sub:d=>`EV/EBITDA: ${d.ev_ebitda?.toFixed(1)||'N/A'}x`},
      {lbl:'Production Growth > 8%',        fn:d=>(d.sd?.production_growth_pct||0)>8,          sub:d=>`Prod: ${pct(d.sd?.production_growth_pct)}`},
      {lbl:'Net Debt / EBITDA < 2x',        fn:d=>(d.sd?.net_debt_ebitda||99)<2,               sub:d=>`ND/EBITDA: ${d.sd?.net_debt_ebitda?.toFixed(1)||'N/A'}x`},
      {lbl:'Reserve Life > 15 Years',       fn:d=>(d.sd?.reserve_life_years||0)>15,            sub:d=>`Life: ${d.sd?.reserve_life_years||'N/A'} yrs`},
      {lbl:'Capacity Utilization > 75%',    fn:d=>(d.sd?.capacity_util_pct||0)>75,             sub:d=>`Util: ${pct(d.sd?.capacity_util_pct)}`},
      {lbl:'Commodity Price Tailwind',      fn:d=>(d.sector_tailwind_score||0)>65,             sub:d=>`Score: ${d.sector_tailwind_score||'N/A'}/100`},
      {lbl:'Capex Funded by Internal Accruals',fn:d=>!!(d.sd?.capex_self_funded),              sub:_=>'Qualitative'},
      {lbl:'Govt / Mineral Policy Support', fn:d=>(d.government_support_score||0)>60,          sub:d=>`Score: ${d.government_support_score||'N/A'}/100`},
      {lbl:'Cost of Production Declining',  fn:d=>!!(d.sd?.cost_declining),                    sub:_=>'Qualitative'},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,0,30),s(d.profit_cagr_3yr_pct,0,50),s(d.operating_margin_pct,10,45),s(d.roe_pct,8,30),si(sd.net_debt_ebitda,0,4),s(sd.production_growth_pct,0,20),s(sd.capacity_util_pct,60,95),s(sd.reserve_life_years,8,35)]; },
    growthReg:0.45, maxGrowthCap:0.25,
  },
  PHARMA: {
    name:'Pharmaceuticals', icon:'💊', color:'#c62828', wacc:0.12,
    note:'Pharma companies are R&D driven. US FDA compliance is binary risk — one warning letter can destroy 30-40% revenue. Domestic branded formulations provide stable recurring base. Watch ANDA pipeline for future US revenue.',
    metrics:[
      {id:'rd_spend_pct',         lbl:'R&D Spend (% Revenue)',   unit:'%', hi:true,  lo:3,  hi_v:15, desc:'>5% = innovation driven'},
      {id:'anda_approvals',       lbl:'ANDA Approvals (Annual)',  unit:'',  hi:true,  lo:0,  hi_v:50, desc:'Revenue entry in US market'},
      {id:'pipeline_drugs',       lbl:'Drugs in Pipeline',        unit:'',  hi:true,  lo:5,  hi_v:50, desc:'Future revenue potential'},
      {id:'us_revenue_pct',       lbl:'US Revenue Mix',           unit:'%', hi:false, lo:10, hi_v:70, desc:'<50% preferred (risk diversification)'},
      {id:'domestic_pct',         lbl:'India Domestic Mix',       unit:'%', hi:true,  lo:20, hi_v:70, desc:'Stable recurring revenue'},
      {id:'domestic_growth_pct',  lbl:'Domestic Growth Rate',     unit:'%', hi:true,  lo:5,  hi_v:25, desc:'>12% = strong domestic'},
      {id:'fda_compliance',       lbl:'US FDA Status',            unit:'',  hi:true,  lo:0,  hi_v:1,  desc:'Clean = no restrictions'},
      {id:'anda_filings',         lbl:'ANDAs Filed (Pipeline)',    unit:'',  hi:true,  lo:5,  hi_v:80, desc:'Future approval potential'},
    ],
    checklist:[
      {lbl:'PAT CAGR > 15%',               fn:d=>(d.profit_cagr_3yr_pct||0)>15,               sub:d=>`CAGR: ${pct(d.profit_cagr_3yr_pct)}`},
      {lbl:'EBITDA Margin > 20%',           fn:d=>(d.operating_margin_pct||0)>20,               sub:d=>`Margin: ${pct(d.operating_margin_pct)}`},
      {lbl:'R&D Spend > 5% Revenue',        fn:d=>(d.sd?.rd_spend_pct||0)>5,                   sub:d=>`R&D: ${pct(d.sd?.rd_spend_pct)}`},
      {lbl:'FDA Status: No Warning Letter', fn:d=>d.sd?.fda_compliance==='Clean',               sub:d=>`Status: ${d.sd?.fda_compliance||'N/A'}`},
      {lbl:'ANDA Pipeline > 10 Drugs',      fn:d=>(d.sd?.pipeline_drugs||0)>10,                sub:d=>`Pipeline: ${d.sd?.pipeline_drugs||'N/A'}`},
      {lbl:'US Revenue < 50% (Diversified)',fn:d=>(d.sd?.us_revenue_pct||100)<50,              sub:d=>`US: ${pct(d.sd?.us_revenue_pct)}`},
      {lbl:'Domestic Growth > 12%',         fn:d=>(d.sd?.domestic_growth_pct||0)>12,           sub:d=>`Dom Growth: ${pct(d.sd?.domestic_growth_pct)}`},
      {lbl:'Low Debt (D/E < 0.5)',          fn:d=>(d.debt_to_equity||1)<0.5,                   sub:d=>`D/E: ${d.debt_to_equity?.toFixed(2)||'N/A'}`},
      {lbl:'ROE > 18%',                     fn:d=>(d.roe_pct||0)>18,                           sub:d=>`ROE: ${pct(d.roe_pct)}`},
      {lbl:'Promoter Holding > 50%',        fn:d=>(d.promoter_holding_pct||0)>50,              sub:d=>`Hold: ${pct(d.promoter_holding_pct)}`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,5,30),s(d.profit_cagr_3yr_pct,5,40),s(d.operating_margin_pct,10,35),s(d.roe_pct,8,30),si(d.debt_to_equity,0,2),s(sd.rd_spend_pct,2,12),s(sd.domestic_growth_pct,5,25),sd.fda_compliance==='Clean'?100:20]; },
    growthReg:0.55, maxGrowthCap:0.28,
  },
  FMCG_CONSUMER: {
    name:'FMCG & Consumer', icon:'🛒', color:'#e65100', wacc:0.11,
    note:'FMCG stocks command premium P/E for brand moat and distribution reach. Volume growth is the most important metric — pricing-led growth is less sustainable. Premiumization and rural penetration are structural tailwinds.',
    metrics:[
      {id:'volume_growth_pct',    lbl:'Volume Growth',           unit:'%', hi:true,  lo:0,  hi_v:15, desc:'>5% = healthy demand'},
      {id:'gross_margin_pct',     lbl:'Gross Margin',            unit:'%', hi:true,  lo:35, hi_v:70, desc:'>50% = strong pricing power'},
      {id:'ad_spend_pct',         lbl:'Ad Spend (% Revenue)',    unit:'%', hi:false, lo:5,  hi_v:20, desc:'Brand investment measure'},
      {id:'market_share_pct',     lbl:'Primary Market Share',    unit:'%', hi:true,  lo:5,  hi_v:60, desc:'Category leadership'},
      {id:'distribution_outlets_m',lbl:'Distribution (Mn outlets)',unit:'M',hi:true, lo:0,  hi_v:10, desc:'Reach = competitive moat'},
      {id:'rural_pct',            lbl:'Rural Revenue Mix',       unit:'%', hi:true,  lo:10, hi_v:50, desc:'Underpenetrated = growth runway'},
    ],
    checklist:[
      {lbl:'Volume Growth > 5%',            fn:d=>(d.sd?.volume_growth_pct||0)>5,              sub:d=>`Vol: ${pct(d.sd?.volume_growth_pct)}`},
      {lbl:'Gross Margin > 45%',            fn:d=>(d.sd?.gross_margin_pct||0)>45,              sub:d=>`GM: ${pct(d.sd?.gross_margin_pct)}`},
      {lbl:'Revenue CAGR > 10%',            fn:d=>(d.revenue_cagr_3yr_pct||0)>10,              sub:d=>`CAGR: ${pct(d.revenue_cagr_3yr_pct)}`},
      {lbl:'PAT CAGR > 12%',               fn:d=>(d.profit_cagr_3yr_pct||0)>12,               sub:d=>`CAGR: ${pct(d.profit_cagr_3yr_pct)}`},
      {lbl:'Market Share Leader / Growing', fn:d=>!!(d.sd?.market_share_growing),              sub:_=>'Qualitative'},
      {lbl:'ROE > 25%',                     fn:d=>(d.roe_pct||0)>25,                           sub:d=>`ROE: ${pct(d.roe_pct)}`},
      {lbl:'Near Debt-Free (D/E < 0.3)',    fn:d=>(d.debt_to_equity||1)<0.3,                   sub:d=>`D/E: ${d.debt_to_equity?.toFixed(2)||'N/A'}`},
      {lbl:'Premiumization Strategy',       fn:d=>!!(d.sd?.premiumization),                    sub:_=>'Qualitative'},
      {lbl:'Strong Brand & Distribution',   fn:d=>(d.competitive_position_score||0)>70,        sub:d=>`Score: ${d.competitive_position_score||'N/A'}/100`},
      {lbl:'Rural / Urban Consumption Tailwind',fn:d=>(d.sector_tailwind_score||0)>65,        sub:d=>`Score: ${d.sector_tailwind_score||'N/A'}/100`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,5,25),s(d.profit_cagr_3yr_pct,5,30),s(d.roe_pct,15,40),s(d.operating_margin_pct,10,30),s(d.net_margin_pct,8,25),si(d.debt_to_equity,0,1),s(sd.volume_growth_pct,0,15),s(sd.gross_margin_pct,35,70)]; },
    growthReg:0.60, maxGrowthCap:0.25,
  },
  REAL_ESTATE: {
    name:'Real Estate', icon:'🏗️', color:'#6a1b9a', wacc:0.13,
    note:'Real estate is cyclical. Pre-sales and collections are the most important leading indicators — they predict revenue 2-3 years ahead. Net debt is critical. Focus on companies with low debt, proven execution, and strong brand.',
    metrics:[
      {id:'pre_sales_cr',          lbl:'Pre-Sales / Bookings (Cr)',unit:'Cr',hi:true, lo:500, hi_v:20000,desc:'Leading revenue indicator'},
      {id:'pre_sales_growth_pct',  lbl:'Pre-Sales Growth YoY',    unit:'%', hi:true,  lo:0,  hi_v:50, desc:'>20% = strong demand'},
      {id:'collections_cr',        lbl:'Collections (Cr)',         unit:'Cr',hi:true, lo:300, hi_v:15000,desc:'Cash conversion quality'},
      {id:'collection_efficiency_pct',lbl:'Collection Efficiency', unit:'%', hi:true, lo:60, hi_v:100,desc:'>85% = healthy'},
      {id:'net_debt_cr',           lbl:'Net Debt (Cr)',            unit:'Cr',hi:false,lo:0,  hi_v:10000,desc:'Lower = financial safety'},
      {id:'avg_realization_sqft',  lbl:'Avg Realization (₹/sqft)',unit:'₹', hi:true,  lo:3000,hi_v:25000,desc:'Premium positioning'},
      {id:'unsold_inventory_months',lbl:'Unsold Inventory',        unit:'M', hi:false, lo:6, hi_v:36, desc:'<18 months = healthy'},
    ],
    checklist:[
      {lbl:'Pre-Sales Growth > 20%',        fn:d=>(d.sd?.pre_sales_growth_pct||0)>20,          sub:d=>`Growth: ${pct(d.sd?.pre_sales_growth_pct)}`},
      {lbl:'Collection Efficiency > 85%',   fn:d=>(d.sd?.collection_efficiency_pct||0)>85,      sub:d=>`Eff: ${pct(d.sd?.collection_efficiency_pct)}`},
      {lbl:'Debt Manageable (D/E < 1x)',    fn:d=>(d.debt_to_equity||99)<1,                    sub:d=>`D/E: ${d.debt_to_equity?.toFixed(2)||'N/A'}`},
      {lbl:'EBITDA Margin > 25%',           fn:d=>(d.operating_margin_pct||0)>25,              sub:d=>`Margin: ${pct(d.operating_margin_pct)}`},
      {lbl:'Adequate Land Bank (>3yr)',     fn:d=>!!(d.sd?.land_bank_adequate),                sub:_=>'Qualitative'},
      {lbl:'Premium Brand / Realization',   fn:d=>(d.sd?.avg_realization_sqft||0)>6000,        sub:d=>`₹${(d.sd?.avg_realization_sqft||0).toLocaleString()}/sqft`},
      {lbl:'Promoter Hold > 50%',           fn:d=>(d.promoter_holding_pct||0)>50,              sub:d=>`Hold: ${pct(d.promoter_holding_pct)}`},
      {lbl:'Real Estate Upcycle Tailwind',  fn:d=>(d.sector_tailwind_score||0)>65,             sub:d=>`Score: ${d.sector_tailwind_score||'N/A'}/100`},
      {lbl:'RERA Compliant Track Record',   fn:d=>!!(d.sd?.rera_compliant),                    sub:_=>'Qualitative'},
      {lbl:'Diversified Portfolio Mix',     fn:d=>!!(d.sd?.diversified_portfolio),              sub:_=>'Qualitative'},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,0,40),s(d.profit_cagr_3yr_pct,0,50),s(d.operating_margin_pct,15,40),si(d.debt_to_equity,0,2),s(sd.pre_sales_growth_pct,0,50),s(sd.collection_efficiency_pct,60,100),si(sd.unsold_inventory_months,6,36),s(d.roe_pct,8,25)]; },
    growthReg:0.45, maxGrowthCap:0.30,
  },
  ENERGY_POWER: {
    name:'Energy & Power', icon:'⚡', color:'#f57f17', wacc:0.10,
    note:'Power sector values stable cash flows with long PPA contracts. DCF suits well with lower WACC (10%) due to asset-backed revenue. Renewable transition is a multi-decade structural tailwind in India. Watch net debt levels carefully.',
    metrics:[
      {id:'plant_load_factor_pct',lbl:'Plant Load Factor (PLF)',  unit:'%', hi:true,  lo:55, hi_v:90, desc:'>70% = efficient operations'},
      {id:'capacity_gw',          lbl:'Installed Capacity (GW)',  unit:'GW',hi:true,  lo:0,  hi_v:50, desc:'Scale of operations'},
      {id:'capacity_under_dev_gw',lbl:'Capacity Under Dev (GW)',  unit:'GW',hi:true,  lo:0,  hi_v:30, desc:'Growth pipeline'},
      {id:'capacity_growth_pct',  lbl:'Capacity Growth (3Y)',     unit:'%', hi:true,  lo:5,  hi_v:50, desc:'>20% = high growth utility'},
      {id:'net_debt_ebitda',      lbl:'Net Debt / EBITDA',        unit:'x', hi:false, lo:0,  hi_v:6,  desc:'<4x = manageable'},
      {id:'renewable_mix_pct',    lbl:'Renewable Energy Mix',     unit:'%', hi:true,  lo:0,  hi_v:100,desc:'Future-proofing indicator'},
      {id:'td_losses_pct',        lbl:'T&D Losses (Discom)',      unit:'%', hi:false, lo:2,  hi_v:20, desc:'<10% = efficient distribution'},
    ],
    checklist:[
      {lbl:'Capacity Growth > 20% (3yr)',   fn:d=>(d.sd?.capacity_growth_pct||0)>20,           sub:d=>`Cap Growth: ${pct(d.sd?.capacity_growth_pct)}`},
      {lbl:'PLF > 70%',                     fn:d=>(d.sd?.plant_load_factor_pct||0)>70,          sub:d=>`PLF: ${pct(d.sd?.plant_load_factor_pct)}`},
      {lbl:'PPA Secured for New Capacity',  fn:d=>!!(d.sd?.ppa_secured),                        sub:_=>'Qualitative'},
      {lbl:'Net Debt / EBITDA < 4x',        fn:d=>(d.sd?.net_debt_ebitda||99)<4,                sub:d=>`ND/EBITDA: ${d.sd?.net_debt_ebitda?.toFixed(1)||'N/A'}x`},
      {lbl:'Renewable Energy Pivot',        fn:d=>(d.sector_tailwind_score||0)>70,              sub:d=>`Score: ${d.sector_tailwind_score||'N/A'}/100`},
      {lbl:'Govt Power Policy Support',     fn:d=>(d.government_support_score||0)>70,           sub:d=>`Score: ${d.government_support_score||'N/A'}/100`},
      {lbl:'EBITDA Margin > 35%',           fn:d=>(d.operating_margin_pct||0)>35,               sub:d=>`Margin: ${pct(d.operating_margin_pct)}`},
      {lbl:'ROCE > 12%',                    fn:d=>(d.roce_pct||0)>12,                           sub:d=>`ROCE: ${pct(d.roce_pct)}`},
      {lbl:'Revenue CAGR > 15%',            fn:d=>(d.revenue_cagr_3yr_pct||0)>15,              sub:d=>`CAGR: ${pct(d.revenue_cagr_3yr_pct)}`},
      {lbl:'Promoter Hold > 50%',           fn:d=>(d.promoter_holding_pct||0)>50,               sub:d=>`Hold: ${pct(d.promoter_holding_pct)}`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,5,35),s(d.profit_cagr_3yr_pct,5,40),s(d.operating_margin_pct,20,50),s(d.roce_pct,8,25),si(sd.net_debt_ebitda,0,6),s(sd.plant_load_factor_pct,55,90),s(sd.capacity_growth_pct,5,50),s(sd.renewable_mix_pct,0,100)]; },
    growthReg:0.55, maxGrowthCap:0.30,
  },
  CHEMICALS: {
    name:'Specialty Chemicals', icon:'🧪', color:'#00695c', wacc:0.12,
    note:'India is becoming a global specialty chemicals hub via China+1 de-risking. Look for companies with unique chemistry/IP, strong export revenue, expanding capacities, and long-term contracts with global MNCs.',
    metrics:[
      {id:'capacity_util_pct',    lbl:'Capacity Utilization',    unit:'%', hi:true,  lo:60, hi_v:95, desc:'>80% = full utilization'},
      {id:'export_revenue_pct',   lbl:'Export Revenue Mix',      unit:'%', hi:true,  lo:20, hi_v:80, desc:'>40% = global reach'},
      {id:'rd_spend_pct',         lbl:'R&D Spend (% Revenue)',   unit:'%', hi:true,  lo:1,  hi_v:8,  desc:'IP building'},
      {id:'china_plus_one_bene',  lbl:'China+1 Beneficiary',     unit:'',  hi:true,  lo:0,  hi_v:1,  desc:'Structural global demand shift'},
      {id:'new_product_launches', lbl:'New Products Launched',   unit:'',  hi:true,  lo:0,  hi_v:20, desc:'Innovation pipeline'},
      {id:'long_term_contracts',  lbl:'Long-Term Contracts',     unit:'',  hi:true,  lo:0,  hi_v:1,  desc:'Revenue visibility'},
    ],
    checklist:[
      {lbl:'Revenue CAGR > 20%',            fn:d=>(d.revenue_cagr_3yr_pct||0)>20,              sub:d=>`CAGR: ${pct(d.revenue_cagr_3yr_pct)}`},
      {lbl:'PAT CAGR > 25%',                fn:d=>(d.profit_cagr_3yr_pct||0)>25,               sub:d=>`CAGR: ${pct(d.profit_cagr_3yr_pct)}`},
      {lbl:'EBITDA Margin > 18%',           fn:d=>(d.operating_margin_pct||0)>18,               sub:d=>`Margin: ${pct(d.operating_margin_pct)}`},
      {lbl:'China+1 Strategy Beneficiary',  fn:d=>!!(d.sd?.china_plus_one_bene),               sub:_=>'Qualitative'},
      {lbl:'Exports > 40% Revenue',         fn:d=>(d.sd?.export_revenue_pct||0)>40,             sub:d=>`Exports: ${pct(d.sd?.export_revenue_pct)}`},
      {lbl:'Low Debt (D/E < 0.5)',          fn:d=>(d.debt_to_equity||99)<0.5,                   sub:d=>`D/E: ${d.debt_to_equity?.toFixed(2)||'N/A'}`},
      {lbl:'ROE > 20%',                     fn:d=>(d.roe_pct||0)>20,                            sub:d=>`ROE: ${pct(d.roe_pct)}`},
      {lbl:'Capacity Expansion Planned',    fn:d=>d.business_overview?.capacity_expansion!=null, sub:_=>'Expansion disclosed'},
      {lbl:'PLI / Govt Scheme Beneficiary', fn:d=>(d.government_support_score||0)>65,           sub:d=>`Score: ${d.government_support_score||'N/A'}/100`},
      {lbl:'Promoter Hold > 50%',           fn:d=>(d.promoter_holding_pct||0)>50,               sub:d=>`Hold: ${pct(d.promoter_holding_pct)}`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,5,40),s(d.profit_cagr_3yr_pct,5,50),s(d.operating_margin_pct,10,35),s(d.roe_pct,10,35),si(d.debt_to_equity,0,2),s(sd.capacity_util_pct,60,95),s(sd.export_revenue_pct,20,80),s(sd.rd_spend_pct,1,8)]; },
    growthReg:0.55, maxGrowthCap:0.35,
  },
  AUTO: {
    name:'Automobiles', icon:'🚗', color:'#1b5e20', wacc:0.12,
    note:'Auto is cyclical with structural EV disruption. Volume growth is the primary metric. Track market share, inventory, and the company\'s EV transition readiness. High capex and working capital make FCF analysis important.',
    metrics:[
      {id:'volume_growth_pct',    lbl:'Volume Growth (Units)',   unit:'%', hi:true,  lo:0,  hi_v:20, desc:'Primary revenue driver'},
      {id:'capacity_util_pct',    lbl:'Capacity Utilization',    unit:'%', hi:true,  lo:55, hi_v:95, desc:'>75% = healthy'},
      {id:'market_share_pct',     lbl:'Segment Market Share',    unit:'%', hi:true,  lo:5,  hi_v:50, desc:'Competitive position'},
      {id:'export_pct',           lbl:'Export Revenue Mix',      unit:'%', hi:true,  lo:5,  hi_v:40, desc:'Revenue diversification'},
      {id:'inventory_days',       lbl:'Dealer Inventory (Days)', unit:'d', hi:false, lo:15, hi_v:60, desc:'<35 days = healthy demand'},
      {id:'ev_readiness',         lbl:'EV Transition Readiness', unit:'',  hi:true,  lo:0,  hi_v:1,  desc:'Critical for next decade'},
    ],
    checklist:[
      {lbl:'Volume Growth > 10%',           fn:d=>(d.sd?.volume_growth_pct||0)>10,             sub:d=>`Vol: ${pct(d.sd?.volume_growth_pct)}`},
      {lbl:'Revenue CAGR > 12%',            fn:d=>(d.revenue_cagr_3yr_pct||0)>12,              sub:d=>`CAGR: ${pct(d.revenue_cagr_3yr_pct)}`},
      {lbl:'PAT CAGR > 15%',               fn:d=>(d.profit_cagr_3yr_pct||0)>15,               sub:d=>`CAGR: ${pct(d.profit_cagr_3yr_pct)}`},
      {lbl:'EBITDA Margin > 12%',           fn:d=>(d.operating_margin_pct||0)>12,              sub:d=>`Margin: ${pct(d.operating_margin_pct)}`},
      {lbl:'Market Share Stable / Growing', fn:d=>(d.competitive_position_score||0)>65,        sub:d=>`Score: ${d.competitive_position_score||'N/A'}/100`},
      {lbl:'EV Transition Readiness: High', fn:d=>d.sd?.ev_readiness==='High',                  sub:d=>`EV Ready: ${d.sd?.ev_readiness||'N/A'}`},
      {lbl:'Dealer Inventory < 35 Days',    fn:d=>(d.sd?.inventory_days||99)<35,               sub:d=>`Inv: ${d.sd?.inventory_days||'N/A'}d`},
      {lbl:'Debt Manageable (D/E < 1x)',    fn:d=>(d.debt_to_equity||99)<1,                    sub:d=>`D/E: ${d.debt_to_equity?.toFixed(2)||'N/A'}`},
      {lbl:'ROE > 15%',                     fn:d=>(d.roe_pct||0)>15,                           sub:d=>`ROE: ${pct(d.roe_pct)}`},
      {lbl:'Promoter Hold > 50%',           fn:d=>(d.promoter_holding_pct||0)>50,              sub:d=>`Hold: ${pct(d.promoter_holding_pct)}`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,5,30),s(d.profit_cagr_3yr_pct,5,40),s(d.operating_margin_pct,8,25),s(d.roe_pct,10,30),si(d.debt_to_equity,0,2),s(sd.volume_growth_pct,0,20),s(sd.capacity_util_pct,55,95),si(sd.inventory_days,15,60)]; },
    growthReg:0.50, maxGrowthCap:0.28,
  },
  TELECOM: {
    name:'Telecom', icon:'📡', color:'#880e4f', wacc:0.11,
    note:'Telecom is a capital-intensive oligopoly. ARPU growth is the primary value driver. High debt from spectrum auctions is sector-wide. Focus on ARPU trajectory, 5G monetisation, and EBITDA margin expansion as the key thesis.',
    metrics:[
      {id:'arpu',                 lbl:'ARPU (₹/month)',           unit:'₹', hi:true,  lo:100, hi_v:300,desc:'Growing ARPU = pricing power'},
      {id:'subscriber_base_m',    lbl:'Subscriber Base (Mn)',     unit:'M', hi:true,  lo:50,  hi_v:600,desc:'Scale = pricing power'},
      {id:'subscriber_growth_pct',lbl:'Subscriber Growth',        unit:'%', hi:true,  lo:0,   hi_v:10, desc:'>3% = gaining share'},
      {id:'ebitda_margin_pct',    lbl:'EBITDA Margin',            unit:'%', hi:true,  lo:30,  hi_v:55, desc:'>40% = efficient'},
      {id:'net_debt_ebitda',      lbl:'Net Debt / EBITDA',        unit:'x', hi:false, lo:0,   hi_v:6,  desc:'<3x = manageable'},
      {id:'fiveg_rollout_pct',    lbl:'5G Coverage (%)',          unit:'%', hi:true,  lo:0,   hi_v:100,desc:'Future revenue driver'},
    ],
    checklist:[
      {lbl:'ARPU Growing YoY',              fn:d=>(d.sd?.arpu||0)>150,                         sub:d=>`ARPU: ₹${d.sd?.arpu||'N/A'}`},
      {lbl:'Subscriber Market Share Stable',fn:d=>(d.competitive_position_score||0)>55,        sub:d=>`Score: ${d.competitive_position_score||'N/A'}/100`},
      {lbl:'EBITDA Margin > 40%',           fn:d=>(d.sd?.ebitda_margin_pct||0)>40,             sub:d=>`Margin: ${pct(d.sd?.ebitda_margin_pct)}`},
      {lbl:'Net Debt / EBITDA < 3.5x',      fn:d=>(d.sd?.net_debt_ebitda||99)<3.5,             sub:d=>`ND/EBITDA: ${d.sd?.net_debt_ebitda?.toFixed(1)||'N/A'}x`},
      {lbl:'Revenue CAGR > 8%',             fn:d=>(d.revenue_cagr_3yr_pct||0)>8,               sub:d=>`CAGR: ${pct(d.revenue_cagr_3yr_pct)}`},
      {lbl:'5G Infrastructure Rollout',     fn:d=>(d.sd?.fiveg_rollout_pct||0)>20,             sub:d=>`5G: ${pct(d.sd?.fiveg_rollout_pct)}`},
      {lbl:'Govt Policy (Spectrum/BSNL)',   fn:d=>(d.government_support_score||0)>60,           sub:d=>`Score: ${d.government_support_score||'N/A'}/100`},
      {lbl:'FCF Positive (Post Capex)',     fn:d=>(d.profit_cagr_3yr_pct||0)>0,               sub:d=>`PAT CAGR: ${pct(d.profit_cagr_3yr_pct)}`},
      {lbl:'Promoter Hold > 50%',           fn:d=>(d.promoter_holding_pct||0)>50,              sub:d=>`Hold: ${pct(d.promoter_holding_pct)}`},
      {lbl:'Sector Duopoly Position',       fn:d=>(d.competitive_position_score||0)>65,        sub:d=>`Score: ${d.competitive_position_score||'N/A'}/100`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,3,20),s(d.profit_cagr_3yr_pct,0,30),s(sd.ebitda_margin_pct,30,55),si(sd.net_debt_ebitda,0,6),s(sd.arpu,100,300),s(sd.subscriber_growth_pct,0,10),s(sd.fiveg_rollout_pct,0,100),s(d.operating_margin_pct,5,30)]; },
    growthReg:0.50, maxGrowthCap:0.22,
  },
  INFRASTRUCTURE: {
    name:'Infrastructure', icon:'🏗️', color:'#37474f', wacc:0.12,
    note:'Infrastructure companies derive value from order books — revenue visibility. Order inflow growth is the primary leading indicator. Execution track record separates leaders from laggards. HAM/EPC mix matters for capital efficiency.',
    metrics:[
      {id:'order_book_cr',        lbl:'Order Book (Cr)',          unit:'Cr',hi:true,  lo:1000,hi_v:200000,desc:'Revenue visibility'},
      {id:'book_to_bill',         lbl:'Order Book / Revenue',     unit:'x', hi:true,  lo:1.5, hi_v:6,  desc:'>3x = 3 years visibility'},
      {id:'order_inflow_growth_pct',lbl:'Order Inflow Growth',   unit:'%', hi:true,  lo:0,   hi_v:40, desc:'Leading indicator'},
      {id:'execution_rate_pct',   lbl:'Execution Rate',           unit:'%', hi:true,  lo:15,  hi_v:35, desc:'% of OB executed/yr'},
      {id:'working_capital_days', lbl:'Working Capital Days',     unit:'d', hi:false, lo:30,  hi_v:150,desc:'<90 days preferred'},
      {id:'net_debt_ebitda',      lbl:'Net Debt / EBITDA',        unit:'x', hi:false, lo:0,   hi_v:4,  desc:'<2.5x = manageable'},
    ],
    checklist:[
      {lbl:'Order Inflow Growth > 15%',     fn:d=>(d.sd?.order_inflow_growth_pct||0)>15,       sub:d=>`Inflow Growth: ${pct(d.sd?.order_inflow_growth_pct)}`},
      {lbl:'Order Book > 3x Revenue',       fn:d=>(d.sd?.book_to_bill||0)>3,                   sub:d=>`B2B: ${d.sd?.book_to_bill?.toFixed(1)||'N/A'}x`},
      {lbl:'Revenue CAGR > 15%',            fn:d=>(d.revenue_cagr_3yr_pct||0)>15,              sub:d=>`CAGR: ${pct(d.revenue_cagr_3yr_pct)}`},
      {lbl:'PAT CAGR > 20%',               fn:d=>(d.profit_cagr_3yr_pct||0)>20,               sub:d=>`CAGR: ${pct(d.profit_cagr_3yr_pct)}`},
      {lbl:'EBITDA Margin > 10%',           fn:d=>(d.operating_margin_pct||0)>10,              sub:d=>`Margin: ${pct(d.operating_margin_pct)}`},
      {lbl:'Net Debt / EBITDA < 2.5x',      fn:d=>(d.sd?.net_debt_ebitda||99)<2.5,             sub:d=>`ND/EBITDA: ${d.sd?.net_debt_ebitda?.toFixed(1)||'N/A'}x`},
      {lbl:'Working Capital < 90 Days',     fn:d=>(d.sd?.working_capital_days||99)<90,          sub:d=>`WC: ${d.sd?.working_capital_days||'N/A'}d`},
      {lbl:'Govt Infra Pipeline Beneficiary',fn:d=>(d.government_support_score||0)>70,         sub:d=>`Score: ${d.government_support_score||'N/A'}/100`},
      {lbl:'ROE > 15%',                     fn:d=>(d.roe_pct||0)>15,                           sub:d=>`ROE: ${pct(d.roe_pct)}`},
      {lbl:'Promoter Hold > 50%',           fn:d=>(d.promoter_holding_pct||0)>50,              sub:d=>`Hold: ${pct(d.promoter_holding_pct)}`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; const sd=d.sd||{}; return [s(d.revenue_cagr_3yr_pct,5,35),s(d.profit_cagr_3yr_pct,5,45),s(d.operating_margin_pct,6,20),s(d.roe_pct,8,25),si(sd.net_debt_ebitda,0,4),si(sd.working_capital_days,30,150),s(sd.book_to_bill,1.5,6),s(sd.order_inflow_growth_pct,0,40)]; },
    growthReg:0.55, maxGrowthCap:0.32,
  },
  DIVERSIFIED: {
    name:'Diversified Conglomerate', icon:'🏢', color:'#4a148c', wacc:0.12,
    note:'Conglomerates are valued at sum-of-parts (SOTP). Use segment-wise EV/EBITDA multiples. Unlocking of subsidiaries via IPOs or demergers can significantly unlock value. Track which segments drag and which drive value.',
    metrics:[
      {id:'segment_count',        lbl:'Business Segments',       unit:'',  hi:false, lo:2,  hi_v:10, desc:'More segments = complexity'},
      {id:'top_segment_revenue_pct',lbl:'Top Segment Revenue %', unit:'%', hi:false, lo:20, hi_v:80, desc:'Lower = diversification'},
    ],
    checklist:[
      {lbl:'Revenue CAGR > 12%',            fn:d=>(d.revenue_cagr_3yr_pct||0)>12,              sub:d=>`CAGR: ${pct(d.revenue_cagr_3yr_pct)}`},
      {lbl:'PAT CAGR > 15%',               fn:d=>(d.profit_cagr_3yr_pct||0)>15,               sub:d=>`CAGR: ${pct(d.profit_cagr_3yr_pct)}`},
      {lbl:'EBITDA Margin > 15%',           fn:d=>(d.operating_margin_pct||0)>15,              sub:d=>`Margin: ${pct(d.operating_margin_pct)}`},
      {lbl:'ROE > 15%',                     fn:d=>(d.roe_pct||0)>15,                           sub:d=>`ROE: ${pct(d.roe_pct)}`},
      {lbl:'ROCE > 15%',                    fn:d=>(d.roce_pct||0)>15,                          sub:d=>`ROCE: ${pct(d.roce_pct)}`},
      {lbl:'Debt Manageable (D/E < 1.5x)', fn:d=>(d.debt_to_equity||99)<1.5,                  sub:d=>`D/E: ${d.debt_to_equity?.toFixed(2)||'N/A'}`},
      {lbl:'Valuation Discount to SOTP',    fn:d=>(d.pe_ratio||99)<(d.sector_pe_avg||20)*0.85, sub:d=>`P/E: ${d.pe_ratio?.toFixed(1)||'N/A'}`},
      {lbl:'Subsidiary Unlocking Catalyst', fn:d=>(d.sector_tailwind_score||0)>60,             sub:d=>`Score: ${d.sector_tailwind_score||'N/A'}/100`},
      {lbl:'Promoter Hold > 50%',           fn:d=>(d.promoter_holding_pct||0)>50,              sub:d=>`Hold: ${pct(d.promoter_holding_pct)}`},
      {lbl:'Management Quality > 70',       fn:d=>(d.management_track_record_score||0)>70,     sub:d=>`Score: ${d.management_track_record_score||'N/A'}/100`},
    ],
    fScore:d=>{ const s=scaleUp, si=scaleDown; return [s(d.revenue_cagr_3yr_pct,5,30),s(d.profit_cagr_3yr_pct,5,40),s(d.operating_margin_pct,8,30),s(d.roe_pct,10,30),s(d.roce_pct,10,35),si(d.debt_to_equity,0,2),s(d.net_margin_pct,5,20),s(d.interest_coverage,1,20)]; },
    growthReg:0.55, maxGrowthCap:0.28,
  },
};

// ── Get sector config (fallback to MANUFACTURING) ──────────
function getSectorConfig(d){
  const bt = (d.business_type||'MANUFACTURING').toUpperCase();
  const c = SECTOR_CONFIGS[bt] || SECTOR_CONFIGS.MANUFACTURING;
  c.primaryColor = c.color;
  return c;
}



// ── Estimate sustainable 5-year growth (regression to mean)
// Fundamental (self-sustaining) EPS growth: retention ratio × ROE.
// ROE (not ROCE) is correct here — sustainable EPS growth is an equity-side
// quantity, and Indian ROCE figures are typically pre-tax (EBIT / capital
// employed), which would overstate growth by roughly the tax wedge.
function calcFundamentalGrowth(d){
  if(!d.eps_ttm || d.eps_ttm<=0) return null;
  // Unknown dividend ≠ zero dividend: assume a modest 20% payout rather
  // than crediting 100% retention to exactly the companies with patchy data.
  const payout = d.dividend_per_share!=null ? d.dividend_per_share/d.eps_ttm : 0.20;
  const retention = Math.max(0, Math.min(1, 1 - payout));
  const roe = (d.roe_pct ?? d.roce_pct);
  if(roe==null) return null;
  return retention * (roe/100);
}

function estimateGrowth(d){
  const cfg = getSectorConfig(d);
  let raw = d.eps_cagr_3yr_pct || d.profit_cagr_3yr_pct || 15;
  // De-bias the covid-rebound base: when the (verified) 5-year history is
  // available, average the claimed 3-yr CAGR with the full-history CAGR —
  // a longer window smooths one-off base effects.
  const pat = (d.financial_history?.pat_cr||[]).filter(x=>x!=null&&x>0);
  if(pat.length >= 4){
    const histCagr = (Math.pow(pat[pat.length-1]/pat[0], 1/(pat.length-1)) - 1) * 100;
    if(isFinite(histCagr)) raw = (raw + histCagr) / 2;
  }
  const regressed = (raw * cfg.growthReg) / 100;      // historical, faded to mean
  const fundamental = calcFundamentalGrowth(d);        // reinvestment × ROE
  // Blend the two views when both exist (self-consistency check)
  const blended = fundamental!=null ? (regressed + fundamental)/2 : regressed;
  d._gHist = regressed; d._gFund = fundamental;         // expose for display
  return Math.max(0, Math.min(blended, cfg.maxGrowthCap));
}

// ── Model 1: 3-Phase DCF (10-year) ──────────────────────
// Discounts at d._wacc (CAPM-derived when beta is available, else the
// sector-specific WACC) so the rate used in the math is the same one
// shown in the report — previously this silently used the flat 12%.
function calcDCF(d){
  const eps = d.eps_ttm;
  if(!eps || eps <= 0) return null;
  const W  = d._wacc || getSectorConfig(d).wacc || WACC;
  const gH = d._g;                            // High-growth phase (yr 1-5)
  const rows = [];
  let cumPV = 0, cur = eps;

  for(let t=1;t<=5;t++){
    cur *= (1+gH);
    const pv = cur / Math.pow(1+W, t);
    cumPV += pv;
    rows.push({yr:t, phase:'High Growth', eps:cur, g:gH, pv, cumPV:cumPV+0});
  }
  for(let t=1;t<=5;t++){
    const gT = gH - (gH - TERMINAL_G) * (t/5);  // Linear decay to terminal
    cur *= (1+gT);
    const yr = 5+t;
    const pv = cur / Math.pow(1+W, yr);
    cumPV += pv;
    rows.push({yr, phase:'Transition', eps:cur, g:gT, pv, cumPV:cumPV+0});
  }
  // Terminal: use normalized exit P/E (sector avg×0.7, floor 12×, cap 28×)
  const exitPE = Math.min(Math.max((d.sector_pe_avg||20)*0.70, 12), 28);
  const termEPS = cur * (1+TERMINAL_G);
  const termVal = termEPS * exitPE;
  const termPV  = termVal / Math.pow(1+W, 10);
  cumPV += termPV;

  return { fairVal: cumPV*(1-MOS), cumPV, termPV, termVal, exitPE, rows, gH, usedWACC: W };
}

// ── Model 2: Benjamin Graham Number ─────────────────────
// Intrinsic Value = √(22.5 × EPS × BVPS)
// Based on: P/E ≤ 15 AND P/B ≤ 1.5  →  15×1.5=22.5
function calcGraham(d){
  const e=d.eps_ttm, b=d.book_value_per_share;
  if(!e||e<=0||!b||b<=0) return null;
  return Math.sqrt(22.5 * e * b);
}

// ── Model 3: Peter Lynch Fair Value ─────────────────────
// P/E should equal EPS growth rate (%)
// Don't pay P/E > 2 × growth rate
function calcLynch(d){
  const e=d.eps_ttm;
  if(!e||e<=0) return null;
  const gPct = d._g * 100;
  const fairPE = Math.min(gPct, 40);   // cap at 40×
  return e * fairPE;
}

// ── Model 4: EV/EBITDA Relative ─────────────────────────
// Fair EV = EBITDA × Sector EV/EBITDA
// Fair Price = (Fair EV − Debt + Cash) / Shares
function calcEV(d){
  const eb=d.ebitda_cr, sm=d.sector_ev_ebitda_avg, sh=d.shares_outstanding_cr;
  if(!eb||!sm||!sh) return null;
  const debt=d.total_debt_cr||0, cash=d.cash_cr||0;
  const fairMC = eb*sm - debt + cash;
  return Math.max(0, fairMC / sh);
}

// ── Model 5: P/B Relative (primary for banks/NBFCs) ─────
// Fair Price = Book Value per Share × Sector Avg P/B
function calcPB(d){
  const b=d.book_value_per_share, sm=d.sector_pb_avg;
  if(!b||b<=0||!sm) return null;
  return b * sm;
}

// ── Weighted Fair Value (sector-aware) ───────────────────
// Banks/NBFCs: P/E-DCF and EV/EBITDA are not meaningful, so they are
// excluded and the blend leans on P/B (primary) + Graham (book-value
// businesses are what Graham's formula was built for).
// Non-banks: Graham is EXCLUDED from the blend — for capital-light
// growth companies it structurally reads 50-70% below market and was
// dragging the blend against exactly the stocks this tool screens
// for. It stays displayed as the deep-value floor. The FCFF cash-flow
// DCF takes weight when capex data allows it, offsetting the EPS-DCF's
// known reinvestment double-count.
function calcFV(d, dcf, graham, lynch, ev, fcf){
  const V=[], W=[];
  const pb = calcPB(d);
  if(d.business_type==='BANKING_NBFC'){
    if(pb)     { V.push(pb);     W.push(0.60); }
    if(graham) { V.push(graham); W.push(0.25); }
    if(lynch)  { V.push(lynch);  W.push(0.15); }
  } else {
    const fcfVal = (fcf && fcf.perShare>0) ? fcf.perShare : null;
    if(dcf)    { V.push(dcf.fairVal); W.push(fcfVal!=null ? 0.35 : 0.50); }
    if(fcfVal!=null){ V.push(fcfVal); W.push(0.15); }
    if(lynch)  { V.push(lynch);       W.push(0.25); }
    if(ev)     { V.push(ev);          W.push(0.25); }
  }
  if(!V.length) return null;
  const wt = W.reduce((a,b)=>a+b,0);
  return V.reduce((s,v,i)=>s+v*W[i],0) / wt;
}

// ── Fair-value dispersion across models ──────────────────
// When models disagree wildly, the blended midpoint is misleading,
// so we surface the spread and a confidence flag.
function calcFVSpread(vals){
  const v = vals.filter(x=>x!=null && x>0);
  if(v.length<2) return null;
  const lo=Math.min(...v), hi=Math.max(...v);
  return { lo, hi, n:v.length, ratio: hi/lo, wide: (hi/lo)>2 };
}

// ── Scenario Targets ────────────────────────────────────
function calcScenarios(d){
  const e=d.eps_ttm, g=d._g, pe=d.pe_ratio||25, spe=d.sector_pe_avg||30;
  if(!e||e<=0) return null;
  const bG=g*0.45, bsG=g, buG=Math.min(g*1.35,0.42);
  const bPE=pe*0.80, bsPE=pe+(spe-pe)*0.40, buPE=spe;
  return {
    bear2: e*Math.pow(1+bG,2)*bPE,
    base2: e*Math.pow(1+bsG,2)*bsPE,
    bull2: e*Math.pow(1+buG,2)*buPE,
    bear5: e*Math.pow(1+bG,5)*bPE,
    base5: e*Math.pow(1+bsG,5)*bsPE,
    bull5: e*Math.pow(1+buG,5)*buPE,
    bG,bsG,buG,bPE,bsPE,buPE
  };
}

// ── Exit-point target ladder: 6M / 1Y / 2Y / 5Y ──────────
// Same growth cases as the scenarios, with one extra honesty rule:
// the P/E multiple re-rates toward its destination LINEARLY over five
// years — multiples don't jump in six months, so near-term targets are
// earnings-driven and the re-rating accrues to the far targets. (At
// t=5 this reproduces the classic scenario numbers exactly.) Short
// horizons are exit/trim references, not promises: market noise
// dominates 6-month moves.
function calcTargetLadder(d){
  const e=d.eps_ttm, g=d._g, cmp=d.current_price;
  if(!e || e<=0 || !cmp || g==null) return null;
  const pe  = d.pe_ratio || (cmp/e);
  const spe = d.sector_pe_avg || 30;
  const cases = {
    bear: { g: g*0.45,               endPE: pe*0.80 },
    base: { g: g,                    endPE: pe + (spe-pe)*0.40 },
    bull: { g: Math.min(g*1.35,0.42), endPE: spe }
  };
  const horizons = [
    { k:'6M', t:0.5, label:'6 months', term:'short' },
    { k:'1Y', t:1,   label:'1 year',   term:'short' },
    { k:'2Y', t:2,   label:'2 years',  term:'long'  },
    { k:'5Y', t:5,   label:'5 years',  term:'long'  }
  ];
  const divYieldPct = d.dividend_per_share ? (d.dividend_per_share/cmp)*100 : 0;
  return horizons.map(h=>{
    const row = { k:h.k, t:h.t, label:h.label, term:h.term };
    for(const [nm,c] of Object.entries(cases)){
      const peT = pe + (c.endPE - pe) * (h.t/5);
      const px  = e * Math.pow(1+c.g, h.t) * peT;
      const cagr = (Math.pow(Math.max(px/cmp,0.01), 1/h.t)-1)*100;
      // total return adds the dividend yield (held flat — conservative)
      row[nm] = { px, ret:(px/cmp-1)*100, cagr, cagrTotal: cagr + divYieldPct };
    }
    return row;
  });
}

// ── PEG Ratio ───────────────────────────────────────────
function calcPEG(pe, growthPct){
  if(!pe||!growthPct||growthPct<=0) return null;
  return pe / growthPct;
}

// ── Quantitative Checklist ──────────────────────────────
// Every item is computed from actual data thresholds
function buildChecklist(d, peg){
  const cfg = getSectorConfig(d);
  d.sd = d.sector_specific_data?.[d.business_type] || {};
  return cfg.checklist.map(item => ({
    lbl: item.lbl,
    pass: !!(item.fn(d)),
    sub: item.sub(d)
  }));
}

// Six-pillar composite. Future Growth carries the second-largest weight —
// a multibagger screener is fundamentally a bet on the future, so demand,
// strategy credibility and sector runway must move the verdict, not just
// decorate the report. Missing qualitative fields fall out of the average
// rather than silently counting as 50.
const SCORE_WEIGHTS = { financial:0.30, growth:0.25, valuation:0.20, quality:0.10, management:0.10, policy:0.05 };
function calcScores(d, peg){
  const cfg = getSectorConfig(d);
  const sc = scaleUp, si = scaleDown;
  const avg = arr => { const v=arr.filter(x=>x!=null&&!isNaN(x)); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const qa  = d.qualitative_assessment || {};

  // 1. Financial strength — sector-specific historical quality (30%)
  const fArr = cfg.fScore(d);
  const fScore = fArr.reduce((a,b)=>a+b,0) / fArr.length;

  // 2. Future growth — demand today, strategy credibility, sector runway,
  //    scalability, and the model's own sustainable-growth estimate (25%)
  const gScore = avg([
    qa.demand_outlook?.score,
    qa.growth_strategy?.score,
    d.sector_tailwind_score,
    d.business_scalability_score,
    d._g!=null ? Math.max(0,Math.min(100,(d._g*100-4)/(28-4)*100)) : null
  ]) ?? 50;

  // 3. Valuation attractiveness (20%)
  const vArr = [];
  if(d.pe_ratio && d.sector_pe_avg) vArr.push(Math.max(0,Math.min(100,(d.sector_pe_avg/d.pe_ratio)*50)));
  if(peg)                           vArr.push(Math.max(0,Math.min(100,(2-peg)*50)));
  if(d.pb_ratio && d.sector_pb_avg) vArr.push(Math.max(0,Math.min(100,(d.sector_pb_avg/d.pb_ratio)*50)));
  // Banking: P/B is primary valuation metric
  if(cfg === SECTOR_CONFIGS.BANKING_NBFC && d.pb_ratio && d.sector_pb_avg){
    vArr.push(Math.max(0,Math.min(100,(d.sector_pb_avg/d.pb_ratio)*70)));
  }
  const vScore = vArr.length ? vArr.reduce((a,b)=>a+b,0)/vArr.length : 50;

  // 4. Business quality & market presence — product quality, share, moat (10%)
  const qScore = avg([
    qa.product_quality?.score,
    qa.market_presence?.score,
    d.competitive_position_score
  ]) ?? 50;

  // 5. Management & governance — skin in the game, pledge, record, trust (10%)
  const mScore = avg([
    d.promoter_holding_pct!=null ? sc(d.promoter_holding_pct, 40, 75) : null,
    d.promoter_pledge_pct !=null ? si(d.promoter_pledge_pct,   0, 20) : null,
    d.management_track_record_score,
    d.management_profile?.trust_score
  ]) ?? 50;

  // 6. Policy & geopolitical safety (5%)
  const pScore = avg([ d.government_support_score, qa.geopolitical?.score ]) ?? 50;

  const w = SCORE_WEIGHTS;
  const composite = fScore*w.financial + gScore*w.growth + vScore*w.valuation
                  + qScore*w.quality + mScore*w.management + pScore*w.policy;
  return { fScore, gScore, vScore, qScore, mScore, pScore, tScore:pScore, composite, weights:w };
}

// ── Data consistency validator ───────────────────────────
// The AI's answers contain redundancy: price÷EPS should equal the P/E it
// claims, the CAGR it claims should be derivable from the history it also
// returns, the forensic inputs should tie to the headline figures. Every
// mismatch is proof of a hallucination somewhere — surface it instead of
// silently computing on it.
function validateDataConsistency(d){
  const checks = [];
  const add = (name, ok, severity, detail) => checks.push({ name, ok: !!ok, severity, detail });
  const within = (a, b, tol) => a!=null && b!=null && b!==0 && Math.abs(a/b - 1) <= tol;
  const h = d.financial_history || {};
  const histLast = arr => { const a=(arr||[]).filter(x=>x!=null); return a.length? a[a.length-1] : null; };
  const histCagr = (arr, yrs) => {
    const a=(arr||[]).filter(x=>x!=null&&x>0);
    if(a.length < yrs+1) return null;
    return (Math.pow(a[a.length-1]/a[a.length-1-yrs], 1/yrs)-1)*100;
  };

  // 1-3: price / multiple identities
  if(d.current_price && d.eps_ttm>0 && d.pe_ratio)
    add('P/E ↔ Price÷EPS', within(d.current_price/d.eps_ttm, d.pe_ratio, 0.12), 'fail',
        `price÷EPS = ${(d.current_price/d.eps_ttm).toFixed(1)} vs claimed P/E ${d.pe_ratio.toFixed(1)}`);
  if(d.market_cap_cr && d.shares_outstanding_cr && d.current_price)
    add('MCap ↔ Price×Shares', within(d.market_cap_cr/d.shares_outstanding_cr, d.current_price, 0.10), 'fail',
        `mcap÷shares = ₹${(d.market_cap_cr/d.shares_outstanding_cr).toFixed(0)} vs price ₹${d.current_price.toFixed(0)}`);
  if(d.current_price && d.book_value_per_share>0 && d.pb_ratio)
    add('P/B ↔ Price÷BVPS', within(d.current_price/d.book_value_per_share, d.pb_ratio, 0.12), 'warn',
        `price÷BVPS = ${(d.current_price/d.book_value_per_share).toFixed(1)} vs claimed P/B ${d.pb_ratio.toFixed(1)}`);

  // 4-5: claimed CAGRs vs the history the same response returned
  const r3 = histCagr(h.revenue_cr, 3);
  if(r3!=null && d.revenue_cagr_3yr_pct!=null)
    add('Revenue CAGR ↔ history', Math.abs(r3 - d.revenue_cagr_3yr_pct) <= 6, 'fail',
        `history implies ${r3.toFixed(1)}%/yr vs claimed ${d.revenue_cagr_3yr_pct.toFixed(1)}%/yr`);
  const p3 = histCagr(h.pat_cr, 3);
  if(p3!=null && d.profit_cagr_3yr_pct!=null)
    add('Profit CAGR ↔ history', Math.abs(p3 - d.profit_cagr_3yr_pct) <= 8, 'fail',
        `history implies ${p3.toFixed(1)}%/yr vs claimed ${d.profit_cagr_3yr_pct.toFixed(1)}%/yr`);

  // 6-7: margins vs history
  const rl = histLast(h.revenue_cr), pl = histLast(h.pat_cr), ol = histLast(h.opm_pct);
  if(rl>0 && pl!=null && d.net_margin_pct!=null)
    add('Net margin ↔ history', Math.abs(pl/rl*100 - d.net_margin_pct) <= 4, 'warn',
        `history implies ${(pl/rl*100).toFixed(1)}% vs claimed ${d.net_margin_pct.toFixed(1)}%`);
  if(ol!=null && d.operating_margin_pct!=null)
    add('Op. margin ↔ history', Math.abs(ol - d.operating_margin_pct) <= 4, 'warn',
        `history shows ${ol.toFixed(1)}% vs claimed ${d.operating_margin_pct.toFixed(1)}%`);

  // 8-10: forensic inputs tie to headline figures
  const pio = d.piotroski_data;
  if(pio && pio.net_income_cr!=null && pl!=null)
    add('Piotroski NI ↔ history PAT', within(pio.net_income_cr, pl, 0.15), 'warn',
        `Piotroski net income ${pio.net_income_cr} vs latest PAT ${pl}`);
  const fo = d.forensic_data, be = d.beneish_data;
  if(pio && fo && pio.total_assets_cr!=null && fo.total_assets_cr!=null)
    add('Assets: Piotroski ↔ Altman', within(pio.total_assets_cr, fo.total_assets_cr, 0.10), 'warn',
        `${pio.total_assets_cr} vs ${fo.total_assets_cr}`);
  if(be && be.sales_t!=null && rl!=null)
    add('Beneish sales ↔ history', within(be.sales_t, rl, 0.15), 'warn',
        `Beneish sales ${be.sales_t} vs latest revenue ${rl}`);

  // 11: EPS × shares ≈ PAT
  if(d.eps_ttm>0 && d.shares_outstanding_cr>0 && pl!=null)
    add('EPS×Shares ↔ PAT', within(d.eps_ttm*d.shares_outstanding_cr, pl, 0.25), 'warn',
        `implies PAT ₹${(d.eps_ttm*d.shares_outstanding_cr).toFixed(0)} Cr vs history ₹${pl} Cr`);

  // 12-14: hard sanity bounds
  if(d.current_price!=null && d.fifty_two_week_high!=null && d.fifty_two_week_low!=null)
    add('Price inside 52-wk range', d.current_price <= d.fifty_two_week_high*1.05 && d.current_price >= d.fifty_two_week_low*0.95, 'fail',
        `₹${d.current_price} vs range ₹${d.fifty_two_week_low}–₹${d.fifty_two_week_high}`);
  if(d.promoter_holding_pct!=null && d.fii_holding_pct!=null && d.dii_holding_pct!=null)
    add('Holdings sum ≤ 100%', d.promoter_holding_pct + d.fii_holding_pct + d.dii_holding_pct <= 102, 'fail',
        `${(d.promoter_holding_pct+d.fii_holding_pct+d.dii_holding_pct).toFixed(1)}% combined`);
  const bounds = [
    ['P/E plausible', d.pe_ratio==null || (d.pe_ratio>0 && d.pe_ratio<500), `P/E ${d.pe_ratio}`],
    ['ROE plausible', d.roe_pct==null || (d.roe_pct>-50 && d.roe_pct<120), `ROE ${d.roe_pct}%`],
    ['D/E plausible', d.debt_to_equity==null || (d.debt_to_equity>=0 && d.debt_to_equity<30), `D/E ${d.debt_to_equity}`]
  ];
  bounds.forEach(([n,ok,det]) => add(n, ok, 'fail', det));

  const failed = checks.filter(c=>!c.ok && c.severity==='fail').length;
  const warned = checks.filter(c=>!c.ok && c.severity==='warn').length;
  return { checks, failed, warned, ran: checks.length };
}

// ── Confidence from DATA QUALITY, not company quality ────
// HIGH means "this run's inputs are verified, self-consistent and complete",
// not "this is a good company" — the two were conflated before.
function deriveConfidence(d, dq, fvSpread){
  const reasons = [];
  let score = 100;
  const verifiedN = (d._provenance && d._provenance.fields) ? d._provenance.fields.length : 0;
  if(!verifiedN){ score -= 25; reasons.push('No independently verified figures — everything below is AI-sourced.'); }
  else if(verifiedN >= 12) reasons.push(`${verifiedN} core figures independently verified.`);
  else { score -= 8; reasons.push(`Only ${verifiedN} figures independently verified.`); }
  if(dq){
    score -= dq.failed*12 + dq.warned*4;
    if(dq.failed) reasons.push(`${dq.failed} hard consistency check(s) FAILED — at least one input is wrong.`);
    if(dq.warned) reasons.push(`${dq.warned} consistency check(s) show soft mismatches.`);
    if(!dq.failed && !dq.warned && dq.ran) reasons.push(`All ${dq.ran} cross-field consistency checks passed.`);
  }
  if(d && d._sanitized && d._sanitized.length){
    score -= Math.min(9, d._sanitized.length*3);
    d._sanitized.forEach(a => reasons.push(`Input auto-corrected: ${a}.`));
  }
  const missing = d ? coreDataMissing(d).missing : 0;
  if(missing){ score -= missing*6; reasons.push(`${missing} core field(s) missing.`); }
  if(fvSpread && fvSpread.wide){
    score -= fvSpread.ratio > 3 ? 25 : 15;
    reasons.push(`Valuation models disagree ${fvSpread.ratio.toFixed(1)}× between lowest and highest — treat the blended fair value loosely.`);
  }
  if(!d.piotroski_data){ score -= 4; reasons.push('Prior-year data absent — Piotroski check could not run.'); }
  if(!d.beneish_data){ score -= 4; reasons.push('Manipulation screen (Beneish) could not run.'); }
  score = Math.max(0, Math.min(100, score));
  const level = score > 72 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';
  return { level, score, reasons };
}

// ── Promoter-stake trend ─────────────────────────────────
// A steadily falling promoter stake is one of the strongest empirical
// red flags in Indian markets — insiders sell what they no longer
// believe in. Computed from VERIFIED Screener shareholding history
// (multi-quarter), zero AI involvement.
function calcPromoterTrend(d){
  const h = d._promoterHistory;
  if(!h || !Array.isArray(h.series) || h.series.length < 2) return null;
  const s = h.series;
  const span = Math.min(5, s.length);              // up to last 4 quarter-steps
  const from = s[s.length - span], to = s[s.length - 1];
  const delta = +(to - from).toFixed(2);
  return { series: s, quarters: h.quarters||[], from, to, delta,
           flag: delta <= -3,                       // >3pp sold over ~a year
           soft: delta <= -1.5 && delta > -3 };
}

// ── Cumulative cash conversion (CFO vs PAT over ~5 years) ──
// Piotroski checks one year; India's classic earnings-quality test is
// cumulative — profits that never become cash across five years point
// to channel stuffing or aggressive accounting. Verified statement data.
function calcCashConversion(d){
  const cfo = d._cfoHistory;
  const pat = (d.financial_history?.pat_cr||[]).filter(x=>x!=null);
  if(!Array.isArray(cfo) || cfo.length < 3 || pat.length < 3) return null;
  const n = Math.min(cfo.length, pat.length);
  const cfoSum = cfo.slice(-n).reduce((a,b)=>a+(b||0),0);
  const patSum = pat.slice(-n).reduce((a,b)=>a+(b||0),0);
  if(patSum <= 0) return null;                     // loss-makers: ratio meaningless
  const ratio = +(cfoSum/patSum).toFixed(2);
  return { years:n, cfoSum:+cfoSum.toFixed(0), patSum:+patSum.toFixed(0), ratio,
           flag: ratio < 0.6, soft: ratio >= 0.6 && ratio < 0.8 };
}

// ── Data sufficiency gate ────────────────────────────────
// Refuse to issue a verdict when core inputs are missing, instead
// of silently defaulting scores to 50 and rating HOLD.
function coreDataMissing(d){
  const core = [d.current_price, d.eps_ttm, d.revenue_cagr_3yr_pct,
                d.roe_pct, d.pe_ratio, d.promoter_holding_pct, d.market_cap_cr];
  const missing = core.filter(v=>v==null).length;
  // No valuation model can run at all (no positive earnings AND no EBITDA)
  const noValuation = (!d.eps_ttm || d.eps_ttm<=0) && !d.ebitda_cr;
  return { insufficient: d.current_price==null || missing>=4 || noValuation, missing, noValuation };
}

// ── Rating derived purely from computed numbers ──────────
// Guardrails: forensic red flags (Beneish, Altman), reverse-DCF expectation
// checks, and the blended fair-value gap can only CAP the rating downward,
// never raise it. A stock flagged for possible earnings manipulation or
// balance-sheet distress must not print a BUY on scenario math alone.
const RATING_ORDER = ['AVOID','HOLD','BUY','STRONG BUY'];
function deriveRating(score5y, composite, d, guards){
  if(d && coreDataMissing(d).insufficient){
    return { r:'INSUFFICIENT DATA', caps:[] };
  }
  let r = score5y>=3.5 && composite>70 ? 'STRONG BUY'
        : score5y>=2.5 && composite>58 ? 'BUY'
        : score5y>=1.8 && composite>44 ? 'HOLD'
        : 'AVOID';
  const base = r;                       // pre-guardrail decision, for the rationale trail
  const caps = [];
  const capTo = (max, why) => {
    if(RATING_ORDER.indexOf(r) > RATING_ORDER.indexOf(max)){
      caps.push({ from:r, to:max, why });
      r = max;
    }
  };
  if(guards){
    const { beneish, altman, revDCF, fv } = guards;
    if(beneish && beneish.flag)
      capTo('HOLD', `Beneish M-score ${beneish.M.toFixed(2)} flags possible earnings manipulation — the reported numbers this analysis rests on may not be reliable.`);
    if(altman && !altman.na && altman.zone==='Distress')
      capTo('AVOID', `Altman Z-score ${altman.Z.toFixed(2)} is in the distress zone — elevated bankruptcy risk overrides the growth thesis.`);
    else if(altman && !altman.na && altman.zone==='Grey')
      capTo('BUY', `Altman Z-score ${altman.Z.toFixed(2)} is in the grey zone — balance-sheet stress cannot be ruled out.`);
    if(revDCF && !revDCF.na && revDCF.bounded==='above')
      capTo('HOLD', 'Reverse DCF: the price implies >60%/yr earnings growth — extreme expectations with very high disappointment risk.');
    else if(revDCF && !revDCF.na && revDCF.implied!=null && revDCF.implied > revDCF.sustainable*1.25)
      capTo('BUY', `Reverse DCF: the price already implies ${(revDCF.implied*100).toFixed(0)}%/yr growth vs a sustainable ${(revDCF.sustainable*100).toFixed(0)}%/yr — priced for perfection, no margin for error.`);
    if(fv && d && d.current_price){
      if(d.current_price > fv*1.25)
        capTo('HOLD', `Price is ${((d.current_price/fv-1)*100).toFixed(0)}% above the blended fair value — the scenario upside depends on the market paying ever-richer multiples.`);
      else if(d.current_price > fv)
        capTo('BUY', 'Price is above the blended fair value of the valuation models — limited margin of safety at today’s level.');
    }
    const { promoterTrend, cashConv } = guards;
    if(promoterTrend && promoterTrend.flag)
      capTo('BUY', `Promoters sold ${Math.abs(promoterTrend.delta).toFixed(1)} percentage points of their stake over the last year (${promoterTrend.from}% → ${promoterTrend.to}%) — insiders reducing exposure is a serious warning.`);
    if(cashConv && cashConv.flag)
      capTo('BUY', `Only ₹${cashConv.ratio} of operating cash was generated per ₹1 of reported profit over ${cashConv.years} years — profits are not turning into cash.`);
  }
  return { r, caps, base };
}

// ── Rating rationale: the full decision trail behind the call ─────
// Everything the verdict rests on, as data — which thresholds were tested
// against which numbers, what the guardrails saw, and what would move the
// rating up or down. Rendered in the report and (condensed) in the PDF so
// no rating ever appears without its justification.
const RATING_RULES = [ ['STRONG BUY',3.5,70], ['BUY',2.5,58], ['HOLD',1.8,44] ];
function buildRatingRationale(d, x){
  const { score5y, scen, sc, rating, base, caps, fv, revDCF, altman, beneish, promoterTrend, cashConv } = x;
  const cmp = d.current_price;
  const cfg = getSectorConfig(d);

  // 1. Growth input — where the single most important number came from
  const growth = {
    histCagr: d.eps_cagr_3yr_pct ?? d.profit_cagr_3yr_pct,
    reg: cfg.growthReg, gHist: d._gHist, gFund: d._gFund, g: d._g, capG: cfg.maxGrowthCap
  };

  // 2. The 5-yr score arithmetic
  const target = (scen && cmp) ? { eps: d.eps_ttm, g: d._g, exitPE: scen.bsPE, base5: scen.base5, cmp, score: score5y } : null;

  // 3. Composite build-up
  const W = sc.weights || SCORE_WEIGHTS;
  const pillars = [
    ['Financial strength', sc.fScore, W.financial], ['Future growth', sc.gScore, W.growth],
    ['Valuation', sc.vScore, W.valuation], ['Quality & market', sc.qScore, W.quality],
    ['Management', sc.mScore, W.management], ['Policy & geo', sc.pScore, W.policy]
  ].map(([name,score,w])=>({ name, score, w, contrib: score*w }));

  // 4. Threshold tests — which band the numbers actually land in
  const tests = RATING_RULES.map(([level, sMin, cMin]) => ({
    level,
    conds: [
      { lbl:`5-yr return score ≥ ${sMin}`, ok: score5y>=sMin, val: score5y.toFixed(2) },
      { lbl:`Composite > ${cMin}`,         ok: sc.composite>cMin, val: sc.composite.toFixed(0) }
    ],
    met: score5y>=sMin && sc.composite>cMin
  }));

  // 5. Guardrail audit — every safety screen, whether it fired or not
  const fmt1=(v,dp=2)=>v==null?null:(+v).toFixed(dp);
  const guardrails = [
    { name:'Earnings-manipulation screen (Beneish M)',
      status: beneish&&beneish.M!=null ? (beneish.flag?'fired':'passed') : 'no data',
      detail: beneish&&beneish.M!=null ? `M = ${fmt1(beneish.M)} (flag above −1.78)` : 'needs 2 years of granular financials' },
    { name:'Bankruptcy-risk screen (Altman Z)',
      status: altman&&altman.na ? 'n/a for banks' : altman&&altman.Z!=null ? (altman.zone==='Distress'?'fired':altman.zone==='Grey'?'caution':'passed') : 'no data',
      detail: altman&&altman.Z!=null ? `Z = ${fmt1(altman.Z)} → ${altman.zone} zone` : '' },
    { name:'Expectations screen (reverse DCF)',
      status: revDCF&&revDCF.na ? 'n/a for banks' : revDCF&&revDCF.implied!=null ? (revDCF.bounded==='above'||revDCF.implied>revDCF.sustainable*1.25?'fired':'passed') : 'no data',
      detail: revDCF&&revDCF.implied!=null ? `price implies ${(revDCF.implied*100).toFixed(1)}%/yr vs sustainable ${(revDCF.sustainable*100).toFixed(1)}%/yr` : '' },
    { name:'Margin-of-safety screen (price vs blended fair value)',
      status: (fv&&cmp) ? (cmp>fv*1.25?'fired':cmp>fv?'caution':'passed') : 'no data',
      detail: (fv&&cmp) ? `price ₹${cmp.toFixed(0)} vs fair value ₹${fv.toFixed(0)} (${((cmp/fv-1)*100).toFixed(0)>0?'+':''}${((cmp/fv-1)*100).toFixed(0)}%)` : '' },
    { name:'Promoter-stake trend (verified shareholding)',
      status: promoterTrend ? (promoterTrend.flag?'fired':promoterTrend.soft?'caution':'passed') : 'no data',
      detail: promoterTrend ? `${promoterTrend.from}% → ${promoterTrend.to}% (${promoterTrend.delta>0?'+':''}${promoterTrend.delta}pp over ~1yr)` : 'shareholding history unavailable' },
    { name:'Cash-conversion screen (CFO vs PAT, cumulative)',
      status: cashConv ? (cashConv.flag?'fired':cashConv.soft?'caution':'passed') : 'no data',
      detail: cashConv ? `₹${cashConv.cfoSum} Cr cash from ₹${cashConv.patSum} Cr profit over ${cashConv.years} yrs (ratio ${cashConv.ratio})` : 'cash-flow history unavailable' }
  ];

  // 6. What would change the call
  let up = null;
  if(caps && caps.length){
    up = `Clearing the guardrail issue${caps.length>1?'s':''} above would restore the pre-guardrail rating of ${base}.`;
  } else {
    const idx = RATING_RULES.findIndex(r0=>r0[0]===base);
    if(idx > 0){
      const [lvl, sMin, cMin] = RATING_RULES[idx-1];
      const needs = [];
      if(score5y < sMin && scen && cmp){
        const neededTarget = sMin * cmp;
        needs.push(`the base-case 5-yr target must reach ₹${neededTarget.toFixed(0)} (now ₹${scen.base5.toFixed(0)}) — i.e. faster verified growth or a cheaper entry price`);
      }
      if(sc.composite <= cMin) needs.push(`the composite score must exceed ${cMin} (now ${sc.composite.toFixed(0)})`);
      if(needs.length) up = `For ${lvl}: ${needs.join('; ')}.`;
    } else if(base==='AVOID'){
      up = `For HOLD: the 5-yr return score must reach 1.8 (now ${score5y.toFixed(2)}) and the composite must exceed 44 (now ${sc.composite.toFixed(0)}).`;
    }
  }
  const curIdx = RATING_RULES.findIndex(r0=>r0[0]===rating);
  const down = rating==='AVOID' ? null :
    `The call drops if the 5-yr score falls below ${RATING_RULES[curIdx]?RATING_RULES[curIdx][1]:1.8} or the composite below ${RATING_RULES[curIdx]?RATING_RULES[curIdx][2]:44} — or immediately if any guardrail fires (manipulation flag, distress zone, priced-for-perfection, price > 125% of fair value).`;

  return { growth, target, pillars, tests, guardrails, up, down, base, rating, composite: sc.composite };
}

// ── Reverse DCF: what EPS growth does today's price already imply? ──
// Same 3-phase structure as calcDCF, solved for the growth rate that makes
// intrinsic value equal the current price. Implied >> sustainable = priced
// for perfection; implied << sustainable = market is skeptical (possible value).
function dcfImpliedValue(d, gH){
  const eps = d.eps_ttm;
  if(!eps || eps<=0) return null;
  const W = d._wacc || getSectorConfig(d).wacc || WACC;   // same rate as the forward DCF
  let cur = eps, cumPV = 0;
  for(let t=1;t<=5;t++){ cur*=(1+gH); cumPV += cur/Math.pow(1+W,t); }
  for(let t=1;t<=5;t++){ const gT=gH-(gH-TERMINAL_G)*(t/5); cur*=(1+gT); cumPV += cur/Math.pow(1+W,5+t); }
  const exitPE = Math.min(Math.max((d.sector_pe_avg||20)*0.70,12),28);
  cumPV += (cur*(1+TERMINAL_G)*exitPE)/Math.pow(1+W,10);
  return cumPV;
}
function calcReverseDCF(d){
  if(d.business_type==='BANKING_NBFC') return { na:true };   // EPS-DCF not meaningful for banks
  const px=d.current_price, eps=d.eps_ttm;
  if(!px || !eps || eps<=0) return null;
  let lo=-0.10, hi=0.60;
  const vLo=dcfImpliedValue(d,lo), vHi=dcfImpliedValue(d,hi);
  if(vLo==null||vHi==null) return null;
  let implied, bounded=null;
  if(px<=vLo){ implied=lo; bounded='below'; }
  else if(px>=vHi){ implied=hi; bounded='above'; }
  else { for(let i=0;i<64;i++){ const mid=(lo+hi)/2; if(dcfImpliedValue(d,mid)<px) lo=mid; else hi=mid; } implied=(lo+hi)/2; }
  const sustainable = d._g;
  let verdict, tone;
  if(implied > sustainable*1.25){ verdict='Priced for perfection — the market already expects faster growth than this business has sustainably delivered. Limited margin for error.'; tone='r'; }
  else if(implied < sustainable*0.75){ verdict='Market is skeptical — the price implies slower growth than the sustainable estimate, leaving room for upside if execution holds.'; tone='g'; }
  else { verdict='Fairly priced — the growth baked into the price is close to the sustainable estimate.'; tone='a'; }
  if(bounded==='above') verdict='The price implies >60%/yr growth — extreme expectations, very high risk of disappointment.', tone='r';
  if(bounded==='below') verdict='The price implies declining earnings — the market is pricing in deterioration; contrarian value only if the thesis is wrong.', tone='g';
  return { implied, sustainable, verdict, tone, bounded };
}

// ── Piotroski F-Score (0–9): fundamental strength / improvement check ──
// Needs current + prior-year figures from piotroski_data. Not meaningful
// for banks. Each test only counts if its data is present.
function calcPiotroski(d){
  if(d.business_type==='BANKING_NBFC') return { na:true };
  const p = d.piotroski_data;
  if(!p) return null;
  const n = v => (v==null||isNaN(v)) ? null : +v;
  const tests = [];
  const add = (lbl,cond) => { if(cond!==null && cond!==undefined) tests.push({lbl,pass:!!cond}); };
  const roa = (ni,as)=> (n(ni)!=null && n(as)) ? ni/as : null;
  const roaC=roa(p.net_income_cr,p.total_assets_cr), roaP=roa(p.net_income_prior_cr,p.total_assets_prior_cr);
  const lev = (ltd,as)=> (n(ltd)!=null && n(as)) ? ltd/as : null;
  const levC=lev(p.long_term_debt_cr,p.total_assets_cr), levP=lev(p.long_term_debt_prior_cr,p.total_assets_prior_cr);
  const shC = n(p.shares_outstanding_cr) ?? n(d.shares_outstanding_cr);
  add('Net income positive',                 n(p.net_income_cr)!=null ? p.net_income_cr>0 : null);
  add('Operating cash flow positive',         n(p.cfo_cr)!=null ? p.cfo_cr>0 : null);
  add('ROA improved YoY',                     (roaC!=null&&roaP!=null) ? roaC>roaP : null);
  add('Cash flow > net income (low accruals)',(n(p.cfo_cr)!=null&&n(p.net_income_cr)!=null) ? p.cfo_cr>p.net_income_cr : null);
  add('Long-term debt ratio fell YoY',        (levC!=null&&levP!=null) ? levC<levP : null);
  add('Current ratio improved YoY',           (n(p.current_ratio)!=null&&n(p.current_ratio_prior)!=null) ? p.current_ratio>p.current_ratio_prior : null);
  add('No share dilution',                    (shC!=null&&n(p.shares_prior_cr)!=null) ? shC<=p.shares_prior_cr : null);
  add('Gross margin improved YoY',            (n(p.gross_margin_pct)!=null&&n(p.gross_margin_prior_pct)!=null) ? p.gross_margin_pct>p.gross_margin_prior_pct : null);
  add('Asset turnover improved YoY',          (n(p.asset_turnover)!=null&&n(p.asset_turnover_prior)!=null) ? p.asset_turnover>p.asset_turnover_prior : null);
  if(!tests.length) return null;
  const score = tests.filter(t=>t.pass).length;
  return { score, max:tests.length, tests };
}

// ── Return decomposition: split the base-case 5Y return into its drivers ──
// total multiple = (1+g)^5  ×  (exitPE / currentPE)
//                = earnings-growth driver × multiple re-rating driver
function calcReturnDecomp(d, scen){
  if(!scen || !d.current_price || !d.eps_ttm || d.eps_ttm<=0) return null;
  const curPE = d.pe_ratio || (d.current_price/d.eps_ttm);
  if(!curPE || curPE<=0) return null;
  const g = d._g, exitPE = scen.bsPE;
  const epsMult = Math.pow(1+g,5);
  const rerate  = exitPE/curPE;
  const total   = epsMult*rerate;
  const lt = Math.log(total);
  const epsShare = lt!==0 ? Math.log(epsMult)/lt : 1;
  const reShare  = lt!==0 ? Math.log(rerate)/lt  : 0;
  return { epsMult, rerate, total, epsShare, reShare, curPE, exitPE, g };
}

// ── News impact: aggregate classified headlines into a short/long-term tilt ──
// Weight each item by magnitude (High3/Med2/Low1), sign by sentiment, and route
// by horizon. Produces a −100..+100 net-sentiment score per horizon, plus an
// alignment read against the fundamental rating (does news confirm or contradict?).
function calcNewsImpact(d, rating){
  const items = (d.recent_news||[]).filter(n=>n && n.headline);
  if(!items.length) return null;
  const wImpact = i => ({high:3,medium:2,low:1}[(i.impact||'medium').toLowerCase()] || 2);
  const sSign   = s => ({positive:1,negative:-1,neutral:0}[(s||'neutral').toLowerCase()] ?? 0);
  let sSum=0,sW=0,lSum=0,lW=0,pos=0,neg=0,neu=0;
  items.forEach(n=>{
    const w=wImpact(n), sg=sSign(n.sentiment), h=(n.horizon||'Both').toLowerCase();
    if(sg>0)pos++; else if(sg<0)neg++; else neu++;
    if(h.includes('short')||h.includes('both')){ sSum+=sg*w; sW+=w; }
    if(h.includes('long') ||h.includes('both')){ lSum+=sg*w; lW+=w; }
  });
  const score = (sum,w)=> w? Math.round(Math.max(-100,Math.min(100, sum/w*100))) : null;
  const lbl = sc => sc==null?'No signal': sc>40?'Positive': sc<-40?'Negative': sc>15?'Mildly +': sc<-15?'Mildly −':'Mixed';
  const shortScore=score(sSum,sW), longScore=score(lSum,lW);

  // Business-impact dimensions: how the news flow bears on profitability,
  // business stability, and trust in management — each a −100..+100 tilt
  // weighted by headline magnitude. null when the AI supplied no reads.
  const dimScore = key => {
    let s=0,w=0;
    items.forEach(n=>{ const v=n[key]; if(v==null) return; s+=sSign(v)*wImpact(n); w+=wImpact(n); });
    return w ? Math.round(Math.max(-100,Math.min(100, s/w*100))) : null;
  };
  const dims = {
    profit:    { score: dimScore('profitability_impact'),     name:'Profitability' },
    stability: { score: dimScore('stability_impact'),         name:'Business stability' },
    trust:     { score: dimScore('management_trust_impact'),  name:'Management trust' }
  };
  Object.values(dims).forEach(x=> x.lbl = lbl(x.score));

  // Alignment of long-term news tilt vs the fundamental rating
  const ratingSign = /STRONG BUY|BUY/.test(rating)?1 : rating==='AVOID'?-1 : 0;
  const newsSign   = longScore==null?0 : longScore>15?1 : longScore<-15?-1 : 0;
  let alignment, aTone;
  if(rating==='INSUFFICIENT DATA'){ alignment='Fundamental rating unavailable — news read shown on its own.'; aTone='a'; }
  else if(ratingSign>0 && newsSign>0){ alignment='News flow REINFORCES the bullish fundamental view — fundamentals and momentum agree.'; aTone='g'; }
  else if(ratingSign>0 && newsSign<0){ alignment='DIVERGENCE — fundamentals look attractive but recent news is negative. Treat as an entry-timing caution and watch for a thesis change.'; aTone='r'; }
  else if(ratingSign<0 && newsSign>0){ alignment='DIVERGENCE — weak fundamentals but positive news flow. Possible bounce, but momentum without fundamentals rarely sustains.'; aTone='a'; }
  else if(ratingSign<0 && newsSign<0){ alignment='News flow CONFIRMS the cautious fundamental view — both point the same way.'; aTone='r'; }
  else { alignment='News flow is broadly neutral relative to the fundamental rating — no strong confirmation either way.'; aTone='a'; }

  return { items, shortScore, longScore, shortLbl:lbl(shortScore), longLbl:lbl(longScore), pos, neg, neu, count:items.length, alignment, aTone, dims };
}

// ════════════════════════════════════════════════════════
// TIER 2/3 — ADVANCED QUANTITATIVE ENGINE
// ════════════════════════════════════════════════════════
const RF = 0.07;    // risk-free (10Y GOI)
const ERP = 0.055;  // equity risk premium

// ── Small-cap size premium ───────────────────────────────
// Small companies carry liquidity and fragility risk the CAPM beta
// doesn't capture; without this the engine systematically overvalues
// microcaps — the natural habitat of a multibagger screener.
function sizePremium(d){
  const mc = d.market_cap_cr;
  if(mc==null || mc<=0) return 0;
  if(mc < 5000)  return 0.015;    // < ₹5,000 Cr
  if(mc < 20000) return 0.0075;   // < ₹20,000 Cr
  return 0;
}

// ── CAPM + capital-structure weighted WACC ───────────────
function calcWACC(d){
  const q = d.quant_data || {};
  if(q.beta==null) return null;                    // no beta → fall back to flat WACC
  const beta = Math.max(0.5, Math.min(2.0, q.beta));  // AI-sourced beta — clamp to sanity
  const ke = RF + beta*ERP;
  const tax = (q.tax_rate_pct!=null?q.tax_rate_pct:25)/100;
  const kd  = (q.cost_of_debt_pct!=null?q.cost_of_debt_pct:9)/100;
  const E = d.market_cap_cr||0, D = d.total_debt_cr||0, V = E+D;
  if(V<=0) return null;
  const we=E/V, wd=D/V;
  let wacc = we*ke + wd*kd*(1-tax) + sizePremium(d);
  wacc = Math.max(0.07, Math.min(0.20, wacc));     // sanity clamp
  return { wacc, ke, kd, tax, we, wd, beta };
}

// ── Generalised 3-phase EPS-DCF value at a given g & WACC ──
function dcfValueAt(d, gH, W){
  const eps=d.eps_ttm;
  if(!eps||eps<=0||!W) return null;
  let cur=eps, cumPV=0;
  for(let t=1;t<=5;t++){ cur*=(1+gH); cumPV+=cur/Math.pow(1+W,t); }
  for(let t=1;t<=5;t++){ const gT=gH-(gH-TERMINAL_G)*(t/5); cur*=(1+gT); cumPV+=cur/Math.pow(1+W,5+t); }
  const exitPE=Math.min(Math.max((d.sector_pe_avg||20)*0.70,12),28);
  cumPV+=(cur*(1+TERMINAL_G)*exitPE)/Math.pow(1+W,10);
  return cumPV;
}

// ── FCFF cash-flow DCF (Tier 3 #8) — the "real" DCF ──────
// EV = Σ PV(FCFF) + PV(terminal); equity = EV − debt + cash; per share.
function calcFCFDCF(d, wacc){
  const q=d.quant_data||{};
  const W = wacc || d._wacc || WACC;
  if(q.capex_cr==null || (q.ebit_cr==null && d.ebitda_cr==null)) return null;
  const sh=d.shares_outstanding_cr; if(!sh) return null;
  const dep=q.depreciation_cr||0, tax=(q.tax_rate_pct!=null?q.tax_rate_pct:25)/100;
  const ebit = q.ebit_cr!=null ? q.ebit_cr : (d.ebitda_cr - dep);
  let fcff = ebit*(1-tax) + dep - q.capex_cr - (q.working_capital_change_cr||0);
  if(fcff<=0) return { negative:true };
  const g=d._g, tg=TERMINAL_G;
  if(W<=tg) return null;
  let cur=fcff, ev=0;
  for(let t=1;t<=5;t++){ cur*=(1+g); ev+=cur/Math.pow(1+W,t); }
  for(let t=1;t<=5;t++){ const gT=g-(g-tg)*(t/5); cur*=(1+gT); ev+=cur/Math.pow(1+W,5+t); }
  const term=(cur*(1+tg))/(W-tg);
  ev += term/Math.pow(1+W,10);
  const equity = ev - (d.total_debt_cr||0) + (d.cash_cr||0);
  const perShare = equity/sh;
  return { perShare: Math.max(0, perShare*(1-MOS)), fcff, ev, wacc:W };
}

// ── Altman Z''-score (emerging-markets, non-manufacturing safe) ──
function calcAltmanZ(d){
  if(d.business_type==='BANKING_NBFC') return { na:true };
  const f=d.forensic_data; if(!f||!f.total_assets_cr) return null;
  const TA=f.total_assets_cr;
  const eq = f.book_equity_cr!=null ? f.book_equity_cr : (f.total_assets_cr-(f.total_liabilities_cr||0));
  if(f.working_capital_cr==null||f.retained_earnings_cr==null||f.ebit_cr==null||f.total_liabilities_cr==null) return null;
  const X1=f.working_capital_cr/TA, X2=f.retained_earnings_cr/TA, X3=f.ebit_cr/TA, X4=eq/f.total_liabilities_cr;
  const Z = 3.25 + 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4;
  const zone = Z>2.6?'Safe':Z>=1.1?'Grey':'Distress';
  return { Z, zone, tone: Z>2.6?'g':Z>=1.1?'a':'r', X1,X2,X3,X4 };
}

// ── Beneish M-score (earnings-manipulation flag) ─────────
function calcBeneishM(d){
  const b=d.beneish_data; if(!b) return null;
  const need=['receivables_t','receivables_p','sales_t','sales_p','cogs_t','cogs_p','current_assets_t','current_assets_p','ppe_t','ppe_p','total_assets_t','total_assets_p','depreciation_t','depreciation_p','sga_t','sga_p','current_liab_t','current_liab_p','ltd_t','ltd_p','net_income_t','cfo_t'];
  for(const k of need){ if(b[k]==null) return { incomplete:true }; }
  const gm=(s,c)=>(s-c)/s;
  const DSRI=(b.receivables_t/b.sales_t)/(b.receivables_p/b.sales_p);
  const GMI = gm(b.sales_p,b.cogs_p)/gm(b.sales_t,b.cogs_t);
  const AQI=(1-(b.current_assets_t+b.ppe_t)/b.total_assets_t)/(1-(b.current_assets_p+b.ppe_p)/b.total_assets_p);
  const SGI=b.sales_t/b.sales_p;
  const DEPI=(b.depreciation_p/(b.depreciation_p+b.ppe_p))/(b.depreciation_t/(b.depreciation_t+b.ppe_t));
  const SGAI=(b.sga_t/b.sales_t)/(b.sga_p/b.sales_p);
  const LVGI=((b.ltd_t+b.current_liab_t)/b.total_assets_t)/((b.ltd_p+b.current_liab_p)/b.total_assets_p);
  const TATA=(b.net_income_t-b.cfo_t)/b.total_assets_t;
  const M = -4.84 + 0.92*DSRI + 0.528*GMI + 0.404*AQI + 0.892*SGI + 0.115*DEPI - 0.172*SGAI + 4.679*TATA - 0.327*LVGI;
  return { M, flag: M>-1.78, tone: M>-1.78?'r':'g' };
}

// ── Multi-year trend & volatility stats (Tier 3 #9) ──────
function calcTrendStats(d){
  const h=d.financial_history; if(!h||!Array.isArray(h.revenue_cr)) return null;
  const clean = a => (a||[]).map(Number).filter(x=>!isNaN(x)&&x>0);
  const cagr = a => a.length>=2 ? Math.pow(a[a.length-1]/a[0], 1/(a.length-1))-1 : null;
  const yoy = a => a.slice(1).map((v,i)=>v/a[i]-1);
  const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
  const std  = a => { const m=mean(a); return Math.sqrt(mean(a.map(x=>(x-m)**2))); };
  // R² of log-linear trend (growth steadiness)
  const r2log = a => {
    if(a.length<3) return null;
    const y=a.map(v=>Math.log(v)), x=a.map((_,i)=>i), mx=mean(x), my=mean(y);
    let sxy=0,sxx=0,syy=0; for(let i=0;i<a.length;i++){ sxy+=(x[i]-mx)*(y[i]-my); sxx+=(x[i]-mx)**2; syy+=(y[i]-my)**2; }
    return syy? (sxy*sxy)/(sxx*syy) : null;
  };
  const rev=clean(h.revenue_cr), pat=clean(h.pat_cr);
  const revYoY = rev.length>=3?yoy(rev):null;
  const consistency = revYoY ? std(revYoY)/(Math.abs(mean(revYoY))||1) : null;  // coeff of variation (lower=steadier)
  const opm=clean(h.opm_pct), roce=clean(h.roce_pct);
  const slope = a => a.length>=2 ? (a[a.length-1]-a[0])/(a.length-1) : null;
  return {
    years: h.years||[],
    revCagr: cagr(rev), patCagr: cagr(pat),
    revConsistency: consistency, revR2: r2log(rev),
    opmTrend: slope(opm), opmLatest: opm[opm.length-1], opmStd: opm.length?std(opm):null,
    roceTrend: slope(roce), roceLatest: roce[roce.length-1], roceMean: roce.length?mean(roce):null,
    n: rev.length
  };
}

// ── Residual income / justified P/B for banks (Tier 3 #11) ──
function calcResidualIncome(d, ke){
  const bvps=d.book_value_per_share, roe=d.roe_pct;
  if(!bvps||bvps<=0||roe==null||!ke) return null;
  const r=roe/100;
  const g = Math.min(r * 0.6, ke-0.005);            // book growth = ROE×retention, capped below ke
  if(ke<=g) return null;
  const justifiedPB = (r - g)/(ke - g);              // Gordon residual-income result
  return { value: bvps*justifiedPB, justifiedPB, ke, impliedROE:r, g };
}

// ── Peer-regression "justified" P/E (Tier 3 #10, single-factor) ──
function calcJustifiedPE(d){
  const peers=(d.competitors||[]).filter(c=>c.pe>0 && c.revenue_growth_pct!=null);
  if(peers.length<3) return null;
  const x=peers.map(c=>c.revenue_growth_pct), y=peers.map(c=>c.pe);
  const n=x.length, mx=x.reduce((a,b)=>a+b)/n, my=y.reduce((a,b)=>a+b)/n;
  let sxy=0,sxx=0,syy=0; for(let i=0;i<n;i++){ sxy+=(x[i]-mx)*(y[i]-my); sxx+=(x[i]-mx)**2; syy+=(y[i]-my)**2; }
  if(sxx===0) return null;
  const slope=sxy/sxx, intercept=my-slope*mx, r2= syy? (sxy*sxy)/(sxx*syy):0;
  const g = d.revenue_cagr_3yr_pct!=null?d.revenue_cagr_3yr_pct:mx;
  const predictedPE = intercept + slope*g;
  const actualPE = d.pe_ratio;
  return { predictedPE, actualPE, r2, n, slope,
    verdict: (predictedPE&&actualPE) ? (actualPE < predictedPE*0.9 ? 'Cheaper than peers justify' : actualPE > predictedPE*1.1 ? 'Richer than peers justify' : 'Fairly valued vs peers') : null };
}

// ════════════════════════════════════════════════════════
// ONE PIPELINE — computeAnalysis(d)
// The single source of truth for a full analysis run. Both the
// on-screen report and the PDF consume this, so the two outputs can
// never diverge. Also sets the d._* fields downstream code expects.
// ════════════════════════════════════════════════════════
// ── Input sanitizer ──────────────────────────────────────
// The AI-sourced sector multiples drive the EV model, the DCF exit
// P/E AND the scenario re-rating — one hallucinated number corrupts
// three models. Clamp them to plausible India ranges and cross-check
// the sector P/E against the median of the peer list the same reply
// returned. Every adjustment is recorded on d._sanitized so the Data
// Quality card can show it.
function sanitizeInputs(d){
  const adj = [];
  const clampF = (field, lo, hi, label) => {
    const v = d[field];
    if(v==null || isNaN(v)) return;
    const c = Math.max(lo, Math.min(hi, v));
    if(c !== v){ adj.push(`${label} ${v} was implausible — clamped to ${c}`); d[field] = c; }
  };
  clampF('sector_pe_avg',        8,   60, 'Sector P/E');
  clampF('sector_pb_avg',        0.5, 12, 'Sector P/B');
  clampF('sector_ev_ebitda_avg', 4,   30, 'Sector EV/EBITDA');

  // Peer-median cross-check on the sector P/E (peers exclude the target)
  const peerPEs = (d.competitors||[]).filter(c=>c && !c.is_target && c.pe>0 && c.pe<200).map(c=>c.pe).sort((a,b)=>a-b);
  if(peerPEs.length >= 3 && d.sector_pe_avg!=null){
    const med = peerPEs.length%2 ? peerPEs[(peerPEs.length-1)/2] : (peerPEs[peerPEs.length/2-1]+peerPEs[peerPEs.length/2])/2;
    if(Math.abs(d.sector_pe_avg - med)/med > 0.40){
      adj.push(`AI sector P/E ${d.sector_pe_avg.toFixed(1)} diverged >40% from the peer median ${med.toFixed(1)} — using the peer median`);
      d.sector_pe_avg = +med.toFixed(1);
    }
  }
  d._sanitized = adj;
  return adj;
}

function computeAnalysis(d){
  sanitizeInputs(d);
  d._g  = estimateGrowth(d);
  d.sd  = d.sector_specific_data?.[d.business_type] || {};
  const cfg = getSectorConfig(d);

  // WACC first — every DCF variant below discounts at this same rate
  const waccObj = calcWACC(d); d._wacc = waccObj ? waccObj.wacc : Math.max(0.07, Math.min(0.20, (cfg.wacc||WACC) + sizePremium(d)));

  const dcf    = calcDCF(d);
  const graham = calcGraham(d);
  const lynch  = calcLynch(d);
  const ev     = calcEV(d);
  const fcfDCF = calcFCFDCF(d, d._wacc);
  const fv     = calcFV(d, dcf, graham, lynch, ev, fcfDCF);
  const scen   = calcScenarios(d);
  // PEG against the engine's own forward growth estimate — Lynch's ratio
  // is P/E vs FUTURE growth, not the trailing CAGR.
  const peg    = calcPEG(d.pe_ratio, d._g!=null ? d._g*100 : (d.profit_cagr_3yr_pct || d.eps_cagr_3yr_pct));
  const cl     = buildChecklist(d, peg);
  const sc     = calcScores(d, peg);
  const revDCF = calcReverseDCF(d);
  const altman  = calcAltmanZ(d);
  const beneish = calcBeneishM(d);
  const promoterTrend = calcPromoterTrend(d);
  const cashConv      = calcCashConversion(d);

  const score5y = scen && d.current_price ? Math.min(5, Math.max(1, scen.base5 / d.current_price)) : 2.0;
  const { r: rating, caps, base } = deriveRating(score5y, sc.composite, d, { beneish, altman, revDCF, fv, promoterTrend, cashConv });
  const dq      = validateDataConsistency(d);
  const confObj = deriveConfidence(d, dq, calcFVSpread([dcf?.fairVal, graham, lynch, ev]));
  const why     = rating==='INSUFFICIENT DATA' ? null
                : buildRatingRationale(d, { score5y, scen, sc, rating, base, caps, fv, revDCF, altman, beneish, promoterTrend, cashConv });
  const news    = calcNewsImpact(d, rating);
  const ladder  = calcTargetLadder(d);
  d._lastRating = rating;                            // snapshot for the library shelf

  const fscore  = calcPiotroski(d);
  const decomp  = calcReturnDecomp(d, scen);
  const trend   = calcTrendStats(d);
  const resInc  = d.business_type==='BANKING_NBFC' ? calcResidualIncome(d, waccObj?waccObj.ke:(RF+ERP)) : null;
  const justPE  = calcJustifiedPE(d);
  const dcfCapm = dcfValueAt(d, d._g, d._wacc);
  const dcfFlat = dcfValueAt(d, d._g, WACC);
  const passCount = cl.filter(x=>x.pass).length;

  return { cfg, waccObj, dcf, graham, lynch, ev, fv, scen, peg, cl, sc,
           revDCF, altman, beneish, score5y, rating, caps, base, dq, confObj,
           conf: confObj.level, why, news, ladder, fscore, decomp, trend,
           fcfDCF, resInc, justPE, dcfCapm, dcfFlat, passCount, usedWACC: d._wacc,
           promoterTrend, cashConv };
}
