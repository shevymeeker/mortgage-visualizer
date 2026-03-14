import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const VIEW_LABELS = {
  overview: 'Summary',
  payments: 'Monthly Payments',
  costs: 'Total Costs',
  equity: 'Equity',
  amortization: 'Year-by-Year',
};

const formatYears = (y) => {
  const years = Math.floor(y);
  const months = Math.round((y % 1) * 12);
  if (months === 0) return `${years} yrs`;
  return `${years} yrs ${months} mos`;
};

const fmt = (n) => Math.round(n).toLocaleString();

const CHART_GRID = { stroke: '#e5e1db' };
const TOOLTIP_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #e5e1db',
  borderRadius: '10px',
  fontSize: '13px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

export default function MortgageAnalyzer() {
  const [housePrice, setHousePrice] = useState(200000);
  const [mortgageRate, setMortgageRate] = useState(6.5);
  const [downPaymentPercent, setDownPaymentPercent] = useState(5);
  const [selectedView, setSelectedView] = useState('overview');
  const [highlightedScenario, setHighlightedScenario] = useState(null);

  const presetScenarios = [
    { id: 1, name: '30-Yr Standard',     term: 30, rate: mortgageRate, accelerated: false, targetYears: null,  color: '#3b82f6' },
    { id: 2, name: '20-Yr Standard',     term: 20, rate: mortgageRate, accelerated: false, targetYears: null,  color: '#10b981' },
    { id: 3, name: '50-Yr Standard',     term: 50, rate: mortgageRate, accelerated: false, targetYears: null,  color: '#ef4444' },
    { id: 4, name: '50-Yr (Paid in 30)', term: 50, rate: mortgageRate, accelerated: true,  targetYears: 30,   color: '#f59e0b' },
    { id: 5, name: '30-Yr (Paid in 20)', term: 30, rate: mortgageRate, accelerated: true,  targetYears: 20,   color: '#8b5cf6' },
    { id: 6, name: '50-Yr Accelerated',  term: 50, rate: mortgageRate, accelerated: true,  targetYears: 36.46, color: '#ec4899' },
    { id: 7, name: '50-Yr (3.5% Down)',  term: 50, rate: mortgageRate, accelerated: false, targetYears: null,  color: '#14b8a6', specialDown: 3.5 },
  ];

  const [activeScenarios, setActiveScenarios] = useState([1, 2, 3]);

  const calculateMortgage = (principal, annualRate, years, acceleratedTargetYears = null) => {
    const monthlyRate = annualRate / 100 / 12;
    const numPayments = years * 12;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

    if (acceleratedTargetYears) {
      const targetPayments = acceleratedTargetYears * 12;
      const targetMonthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, targetPayments)) / (Math.pow(1 + monthlyRate, targetPayments) - 1);
      let balance = principal, totalPaid = 0, totalInterest = 0;
      for (let month = 1; month <= targetPayments; month++) {
        const interestPayment = balance * monthlyRate;
        balance -= (targetMonthlyPayment - interestPayment);
        totalPaid += targetMonthlyPayment;
        totalInterest += interestPayment;
      }
      return { monthlyPayment: totalPaid / targetPayments, totalPaid, totalInterest, numPayments: targetPayments, actualTerm: acceleratedTargetYears };
    }

    const totalPaid = monthlyPayment * numPayments;
    return { monthlyPayment, totalPaid, totalInterest: totalPaid - principal, numPayments, actualTerm: years };
  };

  const getPrincipal = (scenario) => {
    const pct = scenario.specialDown || downPaymentPercent;
    return housePrice - (pct / 100) * housePrice;
  };

  const results = useMemo(() => {
    return presetScenarios
      .filter(s => activeScenarios.includes(s.id))
      .map(scenario => {
        const principal = getPrincipal(scenario);
        const calc = calculateMortgage(principal, scenario.rate, scenario.term, scenario.targetYears);
        return { ...scenario, ...calc, principal };
      });
  }, [activeScenarios, housePrice, downPaymentPercent, mortgageRate]);

  const toggleScenario = (id) => {
    if (activeScenarios.includes(id)) {
      if (activeScenarios.length > 1) setActiveScenarios(activeScenarios.filter(s => s !== id));
    } else {
      setActiveScenarios([...activeScenarios, id]);
    }
  };

  const generateAmortizationSchedule = (result) => {
    const schedule = [];
    const monthlyRate = result.rate / 100 / 12;
    let balance = result.principal;

    for (let year = 1; year <= Math.ceil(result.actualTerm); year++) {
      const isPartialYear = year === Math.ceil(result.actualTerm) && result.actualTerm % 1 !== 0;
      const monthsInYear = isPartialYear ? (result.actualTerm % 1) * 12 : 12;
      let yearPrincipal = 0, yearInterest = 0;

      for (let month = 0; month < monthsInYear && balance > 0; month++) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = Math.min(result.monthlyPayment - interestPayment, balance);
        yearPrincipal += principalPayment;
        yearInterest += interestPayment;
        balance -= principalPayment;
      }

      schedule.push({ year, balance: Math.max(0, balance), principalPaid: yearPrincipal, interestPaid: yearInterest, totalPaid: yearPrincipal + yearInterest });
      if (balance <= 0) break;
    }
    return schedule;
  };

  const scheduleCache = useMemo(() => {
    const cache = {};
    results.forEach(r => { cache[r.id] = generateAmortizationSchedule(r); });
    return cache;
  }, [results]);

  const comparisonData = useMemo(() => results.map(r => ({
    name: r.name,
    'Monthly Payment': Math.round(r.monthlyPayment),
    'Interest Cost': Math.round(r.totalInterest),
    'Total Cost': Math.round(r.totalPaid),
    'Loan Amount': Math.round(r.principal),
    color: r.color,
  })), [results]);

  const balanceOverTimeData = useMemo(() => {
    if (!results.length) return [];
    const maxTerm = Math.max(...results.map(r => r.actualTerm));
    const data = [];
    for (let year = 0; year <= maxTerm; year += 2) {
      const point = { year };
      results.forEach(result => {
        if (year <= result.actualTerm) {
          if (year === 0) {
            point[result.name] = Math.round(result.principal);
          } else {
            const yearData = scheduleCache[result.id]?.find(s => s.year === year);
            if (yearData) point[result.name] = Math.round(yearData.balance);
          }
        }
      });
      data.push(point);
    }
    return data;
  }, [scheduleCache, results]);

  const equityBuildupData = useMemo(() => {
    if (!results.length) return [];
    const maxTerm = Math.max(...results.map(r => r.actualTerm));
    const data = [];
    for (let year = 0; year <= maxTerm; year += 2) {
      const point = { year };
      results.forEach(result => {
        const down = housePrice - result.principal;
        if (year === 0) {
          point[result.name] = Math.round(down);
        } else if (year <= result.actualTerm) {
          const yearData = scheduleCache[result.id]?.find(s => s.year === year);
          if (yearData) point[result.name] = Math.round(down + (result.principal - yearData.balance));
        } else {
          point[result.name] = Math.round(housePrice);
        }
      });
      data.push(point);
    }
    return data;
  }, [scheduleCache, results, housePrice]);

  const bestWorstAnalysis = useMemo(() => {
    if (results.length < 2) return null;
    const lowestPayment  = results.reduce((a, b) => a.monthlyPayment < b.monthlyPayment ? a : b);
    const highestPayment = results.reduce((a, b) => a.monthlyPayment > b.monthlyPayment ? a : b);
    const lowestCost     = results.reduce((a, b) => a.totalInterest < b.totalInterest ? a : b);
    const highestCost    = results.reduce((a, b) => a.totalInterest > b.totalInterest ? a : b);
    return { lowestPayment, highestPayment, lowestCost, highestCost, costDifference: highestCost.totalInterest - lowestCost.totalInterest };
  }, [results]);

  // ─── Shared slider label component ──────────────────────────────────────────
  const SliderField = ({ label, value, display, min, max, step, onChange, hint }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-sm text-stone-500">{label}</label>
        <span className="font-mono text-sm font-semibold text-stone-800">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} />
      <p className="text-xs text-stone-400">{hint}</p>
    </div>
  );

  return (
    <div className="w-full min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="animate-in card p-8 md:p-10">
          <div className="flex items-center gap-5">
            <img src="/wildmanlogo.png" alt="Wildman" className="h-14 md:h-16 w-auto flex-shrink-0" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900 leading-tight">
                Wildman Mortgage Visualizer
              </h1>
              <p className="mt-1 text-stone-500 text-sm md:text-base max-w-xl">
                Seven scenarios, live numbers. Principal and interest only — taxes and insurance are separate.
              </p>
            </div>
          </div>
        </div>

        {/* ── Your Loan ──────────────────────────────────────────────────────── */}
        <div className="animate-in delay-100 card p-8">
          <h2 className="text-lg font-semibold text-stone-800 mb-6">Your Loan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <SliderField
              label="Home Price"
              value={housePrice}
              display={`$${housePrice.toLocaleString()}`}
              min={50000} max={1000000} step={10000}
              onChange={e => setHousePrice(parseInt(e.target.value))}
              hint="$50K — $1M"
            />
            <SliderField
              label="Interest Rate"
              value={mortgageRate}
              display={`${mortgageRate.toFixed(1)}%`}
              min={2} max={12} step={0.1}
              onChange={e => setMortgageRate(parseFloat(e.target.value))}
              hint="2% — 12%"
            />
            <SliderField
              label="Down Payment"
              value={downPaymentPercent}
              display={`${downPaymentPercent}% ($${fmt((downPaymentPercent / 100) * housePrice)})`}
              min={0} max={20} step={0.5}
              onChange={e => setDownPaymentPercent(parseFloat(e.target.value))}
              hint="0% — 20%"
            />
          </div>
        </div>

        {/* ── Compare These Options ──────────────────────────────────────────── */}
        <div className="animate-in delay-200 card p-8">
          <h2 className="text-lg font-semibold text-stone-800 mb-5">Compare These Options</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {presetScenarios.map(scenario => {
              const active = activeScenarios.includes(scenario.id);
              return (
                <button
                  key={scenario.id}
                  onClick={() => toggleScenario(scenario.id)}
                  onMouseEnter={() => setHighlightedScenario(scenario.id)}
                  onMouseLeave={() => setHighlightedScenario(null)}
                  className="text-left p-4 rounded-xl border-2 transition-all duration-150"
                  style={{
                    borderColor: active ? scenario.color : '#e5e1db',
                    background: active ? `${scenario.color}0e` : '#faf9f7',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: scenario.color, opacity: active ? 1 : 0.45 }}
                    />
                    <span className="text-sm font-medium text-stone-800">{scenario.name}</span>
                  </div>
                  <div className="text-xs text-stone-400 font-mono pl-[18px]">
                    {scenario.term}yr @ {scenario.rate}%
                    {scenario.accelerated && ` → ${formatYears(scenario.targetYears)}`}
                  </div>
                  {scenario.specialDown && (
                    <span className="mt-2 ml-[18px] inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Fixed 3.5% down
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab + Content ──────────────────────────────────────────────────── */}
        <div className="animate-in delay-300 card overflow-hidden">

          {/* Tab strip */}
          <div className="flex border-b border-stone-100 px-6 pt-1 gap-0 overflow-x-auto">
            {Object.keys(VIEW_LABELS).map(view => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  selectedView === view
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-stone-400 hover:text-stone-700 hover:border-stone-300'
                }`}
              >
                {VIEW_LABELS[view]}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-8">

            {/* Summary */}
            {selectedView === 'overview' && (
              <div className="animate-in overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-stone-100">
                      {['Scenario', 'Term', 'Rate', 'Loan Amount', 'Monthly Payment', 'Total Paid', 'Interest Cost'].map((h, i) => (
                        <th key={h} className={`py-3 px-4 text-xs font-semibold text-stone-400 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-stone-50 transition-colors ${
                          highlightedScenario === result.id ? 'bg-stone-50' : 'hover:bg-stone-50'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-medium text-sm" style={{ color: result.color }}>
                          {result.name}
                        </td>
                        <td className="text-right py-3.5 px-4 font-mono text-xs text-stone-500">
                          {result.term}yr
                          {result.accelerated && <span className="text-stone-400 ml-1">→ {formatYears(result.actualTerm)}</span>}
                        </td>
                        <td className="text-right py-3.5 px-4 font-mono text-xs text-stone-500">{result.rate}%</td>
                        <td className="text-right py-3.5 px-4 font-mono text-xs text-stone-500">
                          ${result.principal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-right py-3.5 px-4 font-mono text-sm font-semibold" style={{ color: result.color }}>
                          ${result.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-right py-3.5 px-4 font-mono text-xs text-stone-600">
                          ${result.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-right py-3.5 px-4 font-mono text-sm font-semibold" style={{ color: result.color }}>
                          ${result.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Monthly Payments */}
            {selectedView === 'payments' && (
              <div className="animate-in">
                <h2 className="text-base font-semibold text-stone-700 mb-6">Monthly Payment Comparison</h2>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={comparisonData} barSize={40}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} {...CHART_GRID} />
                    <XAxis dataKey="name" tick={{ fill: '#78716c', fontSize: 11 }} angle={-12} textAnchor="end" height={72} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`$${fmt(v)}`, 'Monthly Payment']} />
                    <Bar dataKey="Monthly Payment" radius={[6, 6, 0, 0]}>
                      {comparisonData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Total Costs */}
            {selectedView === 'costs' && (
              <div className="animate-in space-y-10">
                <div>
                  <h2 className="text-base font-semibold text-stone-700 mb-6">Where your money goes</h2>
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={comparisonData} layout="vertical" barSize={22}>
                      <CartesianGrid strokeDasharray="4 4" horizontal={false} {...CHART_GRID} />
                      <XAxis type="number" tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={155} tick={{ fill: '#78716c', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => `$${fmt(v)}`} />
                      <Legend wrapperStyle={{ fontSize: '12px', color: '#78716c' }} />
                      <Bar dataKey="Loan Amount" stackId="a" fill="#0d7264" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Interest Cost" stackId="a" fill="#dc2626" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="pt-8 border-t border-stone-100">
                  <h2 className="text-base font-semibold text-stone-700 mb-6">Interest paid per scenario</h2>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={comparisonData} barSize={40}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} {...CHART_GRID} />
                      <XAxis dataKey="name" tick={{ fill: '#78716c', fontSize: 11 }} angle={-12} textAnchor="end" height={72} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`$${fmt(v)}`, 'Interest Cost']} />
                      <Bar dataKey="Interest Cost" radius={[6, 6, 0, 0]}>
                        {comparisonData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Equity */}
            {selectedView === 'equity' && (
              <div className="animate-in space-y-10">
                <div>
                  <h2 className="text-base font-semibold text-stone-700 mb-6">Equity you're building over time</h2>
                  <ResponsiveContainer width="100%" height={420}>
                    <LineChart data={equityBuildupData}>
                      <CartesianGrid strokeDasharray="4 4" {...CHART_GRID} />
                      <XAxis dataKey="year" tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'Years', position: 'insideBottom', offset: -4, fill: '#a8a29e', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} label={{ value: 'Total Equity ($)', angle: -90, position: 'insideLeft', fill: '#a8a29e', fontSize: 11 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => `$${fmt(v)}`} />
                      <Legend wrapperStyle={{ fontSize: '12px', color: '#78716c' }} />
                      {results.map((result, i) => (
                        <Line key={i} type="monotone" dataKey={result.name} stroke={result.color}
                          strokeWidth={highlightedScenario === result.id ? 3 : 1.5} dot={false}
                          opacity={highlightedScenario && highlightedScenario !== result.id ? 0.25 : 1} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="pt-8 border-t border-stone-100">
                  <h2 className="text-base font-semibold text-stone-700 mb-6">Remaining balance over time</h2>
                  <ResponsiveContainer width="100%" height={420}>
                    <LineChart data={balanceOverTimeData}>
                      <CartesianGrid strokeDasharray="4 4" {...CHART_GRID} />
                      <XAxis dataKey="year" tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'Years', position: 'insideBottom', offset: -4, fill: '#a8a29e', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} label={{ value: 'Balance ($)', angle: -90, position: 'insideLeft', fill: '#a8a29e', fontSize: 11 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => `$${fmt(v)}`} />
                      <Legend wrapperStyle={{ fontSize: '12px', color: '#78716c' }} />
                      {results.map((result, i) => (
                        <Line key={i} type="monotone" dataKey={result.name} stroke={result.color}
                          strokeWidth={highlightedScenario === result.id ? 3 : 1.5} dot={false}
                          opacity={highlightedScenario && highlightedScenario !== result.id ? 0.25 : 1} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Year-by-Year */}
            {selectedView === 'amortization' && results.length > 0 && (
              <div className="animate-in space-y-10">
                {results.map((result, idx) => {
                  const schedule = scheduleCache[result.id];
                  const chartData = schedule.slice(0, 10).map(s => ({
                    year: s.year,
                    'Principal': Math.round(s.principalPaid),
                    'Interest': Math.round(s.interestPaid),
                  }));

                  return (
                    <div key={idx} className={idx > 0 ? 'pt-8 border-t border-stone-100' : ''}>
                      <h2 className="text-base font-semibold mb-5" style={{ color: result.color }}>
                        {result.name}
                      </h2>
                      <div className="mb-6">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={chartData} barSize={18}>
                            <CartesianGrid strokeDasharray="4 4" vertical={false} {...CHART_GRID} />
                            <XAxis dataKey="year" tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => `$${fmt(v)}`} />
                            <Legend wrapperStyle={{ fontSize: '12px', color: '#78716c' }} />
                            <Bar dataKey="Principal" stackId="a" fill="#0d7264" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Interest" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-stone-100">
                              {['Year', 'Principal Paid', 'Interest Paid', 'Total Paid', 'Balance'].map((h, i) => (
                                <th key={h} className={`py-2.5 px-3 text-xs font-semibold text-stone-400 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.slice(0, 10).map((s, i) => (
                              <tr key={i} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-xs text-stone-500">{s.year}</td>
                                <td className="text-right py-2.5 px-3 font-mono text-xs text-teal-700">
                                  ${s.principalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="text-right py-2.5 px-3 font-mono text-xs text-red-600">
                                  ${s.interestPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="text-right py-2.5 px-3 font-mono text-xs text-stone-500">
                                  ${s.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="text-right py-2.5 px-3 font-mono text-xs font-semibold text-stone-700">
                                  ${s.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {schedule.length > 10 && (
                        <p className="text-xs text-stone-400 mt-3">
                          First 10 years shown · Full term: {formatYears(result.actualTerm)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

        {/* ── What the Numbers Show ──────────────────────────────────────────── */}
        {bestWorstAnalysis && (
          <div className="animate-in delay-500 card overflow-hidden">
            <div className="flex">
              <div className="w-1 bg-teal-600 flex-shrink-0" />
              <div className="flex-1 p-8">
                <h3 className="text-lg font-semibold text-stone-800 mb-6">What the Numbers Show</h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-6 border-b border-stone-100">
                  <div>
                    <p className="text-xs text-stone-400 mb-1">Lowest payment</p>
                    <p className="text-xl font-bold font-mono text-stone-900">${fmt(bestWorstAnalysis.lowestPayment.monthlyPayment)}<span className="text-sm font-normal text-stone-400">/mo</span></p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: bestWorstAnalysis.lowestPayment.color }}>{bestWorstAnalysis.lowestPayment.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 mb-1">Highest payment</p>
                    <p className="text-xl font-bold font-mono text-stone-900">${fmt(bestWorstAnalysis.highestPayment.monthlyPayment)}<span className="text-sm font-normal text-stone-400">/mo</span></p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: bestWorstAnalysis.highestPayment.color }}>{bestWorstAnalysis.highestPayment.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 mb-1">Least interest</p>
                    <p className="text-xl font-bold font-mono text-teal-700">${fmt(bestWorstAnalysis.lowestCost.totalInterest)}</p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: bestWorstAnalysis.lowestCost.color }}>{bestWorstAnalysis.lowestCost.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 mb-1">Most interest</p>
                    <p className="text-xl font-bold font-mono text-red-600">${fmt(bestWorstAnalysis.highestCost.totalInterest)}</p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: bestWorstAnalysis.highestCost.color }}>{bestWorstAnalysis.highestCost.name}</p>
                  </div>
                </div>

                <p className="mt-6 text-sm text-stone-600 leading-relaxed">
                  Interest cost ranges from{' '}
                  <span className="font-semibold text-teal-700 font-mono">${fmt(bestWorstAnalysis.lowestCost.totalInterest)}</span>
                  {' '}to{' '}
                  <span className="font-semibold text-red-600 font-mono">${fmt(bestWorstAnalysis.highestCost.totalInterest)}</span>
                  {' '}across these scenarios — a{' '}
                  <span className="font-semibold text-stone-800 font-mono">${fmt(bestWorstAnalysis.costDifference)}</span>
                  {' '}spread. Monthly payments range from{' '}
                  <span className="font-semibold text-stone-800 font-mono">${fmt(bestWorstAnalysis.lowestPayment.monthlyPayment)}</span>
                  {' '}to{' '}
                  <span className="font-semibold text-stone-800 font-mono">${fmt(bestWorstAnalysis.highestPayment.monthlyPayment)}/mo</span>.
                  {' '}Lower payment now means more paid over time. Higher payment builds equity faster and costs less overall.
                  Which trade-off fits your situation is yours to decide.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Notes ──────────────────────────────────────────────────────────── */}
        <div className="animate-in delay-600 rounded-2xl bg-stone-100 px-8 py-6 text-stone-500 text-sm">
          <p className="font-semibold text-stone-600 mb-2">Keep in mind</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Principal and interest only — property taxes, homeowner's insurance, and PMI are not included</li>
            <li>PMI is required when the down payment is below 20%, adding to the true monthly cost</li>
            <li>Accelerated scenarios show what happens when you make higher payments on a longer-term loan</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
