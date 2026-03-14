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

export default function MortgageAnalyzer() {
  const [housePrice, setHousePrice] = useState(200000);
  const [mortgageRate, setMortgageRate] = useState(6.5);
  const [downPaymentPercent, setDownPaymentPercent] = useState(5);
  const [selectedView, setSelectedView] = useState('overview');
  const [highlightedScenario, setHighlightedScenario] = useState(null);

  const presetScenarios = [
    { id: 1, name: '30-Yr Standard', term: 30, rate: mortgageRate, accelerated: false, targetYears: null, color: '#3b82f6' },
    { id: 2, name: '20-Yr Standard', term: 20, rate: mortgageRate, accelerated: false, targetYears: null, color: '#10b981' },
    { id: 3, name: '50-Yr Standard', term: 50, rate: mortgageRate, accelerated: false, targetYears: null, color: '#ef4444' },
    { id: 4, name: '50-Yr (Paid in 30)', term: 50, rate: mortgageRate, accelerated: true, targetYears: 30, color: '#f59e0b' },
    { id: 5, name: '30-Yr (Paid in 20)', term: 30, rate: mortgageRate, accelerated: true, targetYears: 20, color: '#8b5cf6' },
    { id: 6, name: '50-Yr Accelerated', term: 50, rate: mortgageRate, accelerated: true, targetYears: 36.46, color: '#ec4899' },
    { id: 7, name: '50-Yr (3.5% Down)', term: 50, rate: mortgageRate, accelerated: false, targetYears: null, color: '#14b8a6', specialDown: 3.5 },
  ];

  const [activeScenarios, setActiveScenarios] = useState([1, 2, 3]);

  const calculateMortgage = (principal, annualRate, years, acceleratedTargetYears = null) => {
    // Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    const monthlyRate = annualRate / 100 / 12;
    const numPayments = years * 12;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

    if (acceleratedTargetYears) {
      const targetPayments = acceleratedTargetYears * 12;
      const targetMonthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, targetPayments)) / (Math.pow(1 + monthlyRate, targetPayments) - 1);

      let balance = principal;
      let totalPaid = 0;
      let totalInterest = 0;

      for (let month = 1; month <= targetPayments; month++) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = targetMonthlyPayment - interestPayment;
        balance -= principalPayment;
        totalPaid += targetMonthlyPayment;
        totalInterest += interestPayment;
      }

      return {
        monthlyPayment: totalPaid / targetPayments,
        totalPaid: totalPaid,
        totalInterest: totalInterest,
        numPayments: targetPayments,
        actualTerm: acceleratedTargetYears
      };
    }

    const totalPaid = monthlyPayment * numPayments;
    const totalInterest = totalPaid - principal;

    return {
      monthlyPayment: monthlyPayment,
      totalPaid: totalPaid,
      totalInterest: totalInterest,
      numPayments: numPayments,
      actualTerm: years
    };
  };

  const getPrincipal = (scenario) => {
    const downPercent = scenario.specialDown || downPaymentPercent;
    const downPayment = (downPercent / 100) * housePrice;
    return housePrice - downPayment;
  };

  const results = useMemo(() => {
    return presetScenarios
      .filter(s => activeScenarios.includes(s.id))
      .map(scenario => {
        const principal = getPrincipal(scenario);
        const calc = calculateMortgage(principal, scenario.rate, scenario.term, scenario.targetYears);
        return {
          ...scenario,
          ...calc,
          principal
        };
      });
  }, [activeScenarios, housePrice, downPaymentPercent, mortgageRate]);

  const toggleScenario = (id) => {
    if (activeScenarios.includes(id)) {
      if (activeScenarios.length > 1) {
        setActiveScenarios(activeScenarios.filter(s => s !== id));
      }
    } else {
      setActiveScenarios([...activeScenarios, id]);
    }
  };

  const generateAmortizationSchedule = (result) => {
    // Year-by-year breakdown. Years are 1-indexed (Year 1 = first 12 payments).
    const schedule = [];
    const monthlyRate = result.rate / 100 / 12;
    let balance = result.principal;

    for (let year = 1; year <= Math.ceil(result.actualTerm); year++) {
      // For fractional-year terms (e.g. 36.46 yrs), the final year has fewer months
      const isPartialYear = year === Math.ceil(result.actualTerm) && result.actualTerm % 1 !== 0;
      const monthsInYear = isPartialYear ? (result.actualTerm % 1) * 12 : 12;

      let yearPrincipal = 0;
      let yearInterest = 0;

      for (let month = 0; month < monthsInYear && balance > 0; month++) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = Math.min(result.monthlyPayment - interestPayment, balance);
        yearPrincipal += principalPayment;
        yearInterest += interestPayment;
        balance -= principalPayment;
      }

      schedule.push({
        year,
        balance: Math.max(0, balance),
        principalPaid: yearPrincipal,
        interestPaid: yearInterest,
        totalPaid: yearPrincipal + yearInterest
      });

      if (balance <= 0) break;
    }

    return schedule;
  };

  // Pre-compute all amortization schedules once; reused across all chart/table renders
  const scheduleCache = useMemo(() => {
    const cache = {};
    results.forEach(r => { cache[r.id] = generateAmortizationSchedule(r); });
    return cache;
  }, [results]);

  const comparisonData = useMemo(() => {
    return results.map(r => ({
      name: r.name,
      'Monthly Payment': Math.round(r.monthlyPayment),
      'Interest Cost': Math.round(r.totalInterest),
      'Total Cost': Math.round(r.totalPaid),
      'Loan Amount': Math.round(r.principal),
      color: r.color
    }));
  }, [results]);

  const balanceOverTimeData = useMemo(() => {
    if (results.length === 0) return [];

    const maxTerm = Math.max(...results.map(r => r.actualTerm));
    const data = [];

    for (let year = 0; year <= maxTerm; year += 2) {
      const point = { year };

      results.forEach(result => {
        if (year <= result.actualTerm) {
          if (year === 0) {
            // Before any payments: balance is the full loan amount
            point[result.name] = Math.round(result.principal);
          } else {
            const schedule = scheduleCache[result.id];
            const yearData = schedule.find(s => s.year === year);
            if (yearData) {
              point[result.name] = Math.round(yearData.balance);
            }
          }
        }
      });

      data.push(point);
    }

    return data;
  }, [scheduleCache, results]);

  const equityBuildupData = useMemo(() => {
    if (results.length === 0) return [];

    const maxTerm = Math.max(...results.map(r => r.actualTerm));
    const data = [];

    for (let year = 0; year <= maxTerm; year += 2) {
      const point = { year };

      results.forEach(result => {
        // Down payment is equity from day one
        const downPaymentDollars = housePrice - result.principal;

        if (year === 0) {
          point[result.name] = Math.round(downPaymentDollars);
        } else if (year <= result.actualTerm) {
          const schedule = scheduleCache[result.id];
          const yearData = schedule.find(s => s.year === year);
          if (yearData) {
            point[result.name] = Math.round(downPaymentDollars + (result.principal - yearData.balance));
          }
        } else {
          // Loan fully paid — equity equals the full home value
          point[result.name] = Math.round(housePrice);
        }
      });

      data.push(point);
    }

    return data;
  }, [scheduleCache, results, housePrice]);

  const bestWorstAnalysis = useMemo(() => {
    if (results.length < 2) return null;

    const lowestPayment = results.reduce((min, r) => r.monthlyPayment < min.monthlyPayment ? r : min);
    const highestPayment = results.reduce((max, r) => r.monthlyPayment > max.monthlyPayment ? r : max);
    const lowestCost = results.reduce((min, r) => r.totalInterest < min.totalInterest ? r : min);
    const highestCost = results.reduce((max, r) => r.totalInterest > max.totalInterest ? r : max);
    const costDifference = highestCost.totalInterest - lowestCost.totalInterest;

    return { lowestPayment, highestPayment, lowestCost, highestCost, costDifference };
  }, [results]);

  return (
    <div className="w-full min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="animate-in relative overflow-hidden rounded-2xl border border-indigo-200 p-8 md:p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-teal-50" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-100 to-transparent rounded-full -mr-48 -mt-48 opacity-30" />
          <div className="relative z-10 flex items-center gap-6">
            <img src="/wildmanlogo.png" alt="Wildman logo" className="h-16 md:h-20 w-auto" />
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2 tracking-tight">Wildman Mortgage Visualizer</h1>
              <p className="text-lg text-slate-600 max-w-2xl">Compare seven mortgage scenarios side by side with live calculations. All figures show principal and interest only.</p>
            </div>
          </div>
        </div>

        {/* Your Loan */}
        <div className="animate-in delay-100 bg-white rounded-2xl border border-indigo-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Loan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <label className="text-sm font-medium text-slate-700">Home Price</label>
                <span className="font-mono text-lg font-bold text-teal-700">${housePrice.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="50000"
                max="1000000"
                step="10000"
                value={housePrice}
                onChange={(e) => setHousePrice(parseInt(e.target.value))}
                className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
              <p className="text-xs text-slate-500">$50K — $1M</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <label className="text-sm font-medium text-slate-700">Interest Rate</label>
                <span className="font-mono text-lg font-bold text-teal-700">{mortgageRate.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                step="0.1"
                value={mortgageRate}
                onChange={(e) => setMortgageRate(parseFloat(e.target.value))}
                className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
              <p className="text-xs text-slate-500">2% — 12%</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <label className="text-sm font-medium text-slate-700">Down Payment</label>
                <span className="font-mono text-lg font-bold text-teal-700">{downPaymentPercent}% (${((downPaymentPercent / 100) * housePrice).toLocaleString()})</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={downPaymentPercent}
                onChange={(e) => setDownPaymentPercent(parseFloat(e.target.value))}
                className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
              <p className="text-xs text-slate-500">0% — 20%</p>
            </div>
          </div>
        </div>

        {/* Compare These Options */}
        <div className="animate-in delay-200 bg-white rounded-2xl border border-indigo-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Compare These Options</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {presetScenarios.map(scenario => (
              <button
                key={scenario.id}
                onClick={() => toggleScenario(scenario.id)}
                onMouseEnter={() => setHighlightedScenario(scenario.id)}
                onMouseLeave={() => setHighlightedScenario(null)}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  activeScenarios.includes(scenario.id)
                    ? 'border-current shadow-md'
                    : 'border-indigo-200 bg-slate-50 hover:border-indigo-300 hover:bg-white'
                }`}
                style={{
                  borderColor: activeScenarios.includes(scenario.id) ? scenario.color : undefined,
                  background: activeScenarios.includes(scenario.id)
                    ? `linear-gradient(135deg, ${scenario.color}11 0%, ${scenario.color}06 100%)`
                    : undefined
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: scenario.color,
                      opacity: activeScenarios.includes(scenario.id) ? 1 : 0.5
                    }}
                  />
                  <span className="text-sm font-medium text-slate-900">{scenario.name}</span>
                </div>
                <div className="mt-2 text-xs text-slate-600 font-mono">
                  {scenario.term}yr @ {scenario.rate}%
                  {scenario.accelerated && ` → ${formatYears(scenario.targetYears)}`}
                </div>
                {scenario.specialDown && (
                  <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                    Fixed 3.5% down
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Unified card: tab strip + content */}
        <div className="animate-in delay-300 bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">

          {/* Tab strip */}
          <div className="flex flex-wrap gap-1 px-4 pt-4 pb-0 border-b border-indigo-200">
            {Object.keys(VIEW_LABELS).map(view => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={`px-5 py-2 rounded-t-xl font-medium text-sm transition-all duration-200 -mb-px ${
                  selectedView === view
                    ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-sm border border-indigo-200 border-b-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-indigo-100 border border-transparent'
                }`}
              >
                {VIEW_LABELS[view]}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-8">

            {/* Summary (Overview) */}
            {selectedView === 'overview' && (
              <div className="animate-in">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Side-by-Side Comparison</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-indigo-50 to-teal-50 border-b-2 border-indigo-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Scenario</th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-700">Term</th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-700">Rate</th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-700">Loan Amount</th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-700">Monthly Payment</th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-700">Total Paid</th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-700">Interest Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-indigo-100 transition-colors duration-200 ${
                            highlightedScenario === result.id ? 'bg-gradient-to-r from-teal-50 to-indigo-50' : 'hover:bg-indigo-50'
                          }`}
                        >
                          <td className="py-3 px-4 font-medium" style={{ color: result.color }}>
                            {result.name}
                          </td>
                          <td className="text-right py-3 px-4 font-mono">
                            {result.term}yr
                            {result.accelerated && (
                              <span className="text-xs text-slate-500 ml-1">→ {formatYears(result.actualTerm)}</span>
                            )}
                          </td>
                          <td className="text-right py-3 px-4 font-mono">{result.rate}%</td>
                          <td className="text-right py-3 px-4 text-slate-600 font-mono">
                            ${result.principal.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </td>
                          <td className="text-right py-3 px-4 font-semibold font-mono" style={{ color: result.color }}>
                            ${result.monthlyPayment.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </td>
                          <td className="text-right py-3 px-4 font-mono">
                            ${result.totalPaid.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </td>
                          <td className="text-right py-3 px-4 font-semibold font-mono" style={{ color: result.color }}>
                            ${result.totalInterest.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Monthly Payments */}
            {selectedView === 'payments' && (
              <div className="animate-in">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Monthly Payment Comparison</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                    <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} angle={-15} textAnchor="end" height={80} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} label={{ value: 'Monthly Payment ($)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '12px' }}
                      formatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Bar dataKey="Monthly Payment" radius={[12, 12, 0, 0]}>
                      {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Total Costs */}
            {selectedView === 'costs' && (
              <div className="animate-in space-y-10">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Total Cost Breakdown</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={comparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                      <XAxis type="number" tick={{ fill: '#475569', fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fill: '#475569', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '12px' }}
                        formatter={(value) => `$${value.toLocaleString()}`}
                      />
                      <Legend />
                      <Bar dataKey="Loan Amount" stackId="a" fill="#14b8a6" />
                      <Bar dataKey="Interest Cost" stackId="a" fill="#dc2626" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="border-t border-indigo-100 pt-10">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Interest Cost by Scenario</h2>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                      <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} angle={-15} textAnchor="end" height={80} />
                      <YAxis tick={{ fill: '#475569', fontSize: 12 }} label={{ value: 'Interest Cost ($)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '12px' }}
                        formatter={(value) => `$${value.toLocaleString()}`}
                      />
                      <Bar dataKey="Interest Cost" radius={[12, 12, 0, 0]}>
                        {comparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
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
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Total Equity Over Time</h2>
                  <ResponsiveContainer width="100%" height={450}>
                    <LineChart data={equityBuildupData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                      <XAxis
                        dataKey="year"
                        label={{ value: 'Years', position: 'insideBottom', offset: -5, fill: '#475569' }}
                        tick={{ fill: '#475569', fontSize: 12 }}
                      />
                      <YAxis
                        label={{ value: 'Total Equity ($)', angle: -90, position: 'insideLeft', fill: '#475569' }}
                        tick={{ fill: '#475569', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '12px' }}
                        formatter={(value) => `$${value.toLocaleString()}`}
                      />
                      <Legend />
                      {results.map((result, idx) => (
                        <Line
                          key={idx}
                          type="monotone"
                          dataKey={result.name}
                          stroke={result.color}
                          strokeWidth={highlightedScenario === result.id ? 4 : 2}
                          dot={false}
                          opacity={highlightedScenario && highlightedScenario !== result.id ? 0.3 : 1}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="border-t border-indigo-100 pt-10">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Remaining Balance Over Time</h2>
                  <ResponsiveContainer width="100%" height={450}>
                    <LineChart data={balanceOverTimeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                      <XAxis
                        dataKey="year"
                        label={{ value: 'Years', position: 'insideBottom', offset: -5, fill: '#475569' }}
                        tick={{ fill: '#475569', fontSize: 12 }}
                      />
                      <YAxis
                        label={{ value: 'Remaining Balance ($)', angle: -90, position: 'insideLeft', fill: '#475569' }}
                        tick={{ fill: '#475569', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '12px' }}
                        formatter={(value) => `$${value.toLocaleString()}`}
                      />
                      <Legend />
                      {results.map((result, idx) => (
                        <Line
                          key={idx}
                          type="monotone"
                          dataKey={result.name}
                          stroke={result.color}
                          strokeWidth={highlightedScenario === result.id ? 4 : 2}
                          dot={false}
                          opacity={highlightedScenario && highlightedScenario !== result.id ? 0.3 : 1}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Year-by-Year (Amortization) */}
            {selectedView === 'amortization' && results.length > 0 && (
              <div className="animate-in space-y-10">
                {results.map((result, idx) => {
                  const schedule = scheduleCache[result.id];
                  const scheduleData = schedule.slice(0, 10).map(s => ({
                    year: s.year,
                    'Principal Paid': Math.round(s.principalPaid),
                    'Interest Paid': Math.round(s.interestPaid),
                    'Remaining Balance': Math.round(s.balance)
                  }));

                  return (
                    <div key={idx} className={idx > 0 ? 'border-t border-indigo-100 pt-10' : ''}>
                      <h2 className="text-2xl font-bold mb-6" style={{ color: result.color }}>
                        {result.name} — Year-by-Year
                      </h2>
                      <div className="mb-6">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={scheduleData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                            <XAxis dataKey="year" tick={{ fill: '#475569' }} label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                            <YAxis tick={{ fill: '#475569' }} label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '12px' }} formatter={(value) => `$${value.toLocaleString()}`} />
                            <Legend />
                            <Bar dataKey="Principal Paid" stackId="a" fill="#14b8a6" />
                            <Bar dataKey="Interest Paid" stackId="a" fill="#dc2626" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gradient-to-r from-indigo-50 to-teal-50 border-b-2 border-indigo-200">
                            <tr>
                              <th className="text-left py-2 px-3 font-semibold text-slate-700">Year</th>
                              <th className="text-right py-2 px-3 font-semibold text-slate-700">Principal Paid</th>
                              <th className="text-right py-2 px-3 font-semibold text-slate-700">Interest Paid</th>
                              <th className="text-right py-2 px-3 font-semibold text-slate-700">Total Paid</th>
                              <th className="text-right py-2 px-3 font-semibold text-slate-700">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.slice(0, 10).map((s, i) => (
                              <tr key={i} className="border-b border-indigo-100 hover:bg-indigo-50">
                                <td className="py-2 px-3 font-mono">{s.year}</td>
                                <td className="text-right py-2 px-3 text-teal-600 font-mono">
                                  ${s.principalPaid.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </td>
                                <td className="text-right py-2 px-3 text-red-600 font-mono">
                                  ${s.interestPaid.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </td>
                                <td className="text-right py-2 px-3 font-mono">
                                  ${s.totalPaid.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </td>
                                <td className="text-right py-2 px-3 font-semibold font-mono">
                                  ${s.balance.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {schedule.length > 10 && (
                        <p className="text-sm text-slate-500 mt-4">Showing first 10 years. Full term: {formatYears(result.actualTerm)}.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

        {/* What the Numbers Show */}
        {bestWorstAnalysis && (
          <div className="animate-in delay-500 bg-gradient-to-br from-teal-50 via-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">What the Numbers Show</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-indigo-100">
                <p className="text-slate-600 text-xs font-medium uppercase tracking-wide mb-2">Lowest Monthly Payment</p>
                <p className="font-bold text-xl mb-1" style={{ color: bestWorstAnalysis.lowestPayment.color }}>
                  {bestWorstAnalysis.lowestPayment.name}
                </p>
                <p className="text-slate-900 font-semibold font-mono">
                  ${Math.round(bestWorstAnalysis.lowestPayment.monthlyPayment).toLocaleString()}/month
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-indigo-100">
                <p className="text-slate-600 text-xs font-medium uppercase tracking-wide mb-2">Lowest Interest Cost</p>
                <p className="font-bold text-xl mb-1" style={{ color: bestWorstAnalysis.lowestCost.color }}>
                  {bestWorstAnalysis.lowestCost.name}
                </p>
                <p className="text-teal-600 font-semibold font-mono">
                  ${Math.round(bestWorstAnalysis.lowestCost.totalInterest).toLocaleString()} in interest
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-indigo-100">
                <p className="text-slate-600 text-xs font-medium uppercase tracking-wide mb-2">Highest Interest Cost</p>
                <p className="font-bold text-xl mb-1" style={{ color: bestWorstAnalysis.highestCost.color }}>
                  {bestWorstAnalysis.highestCost.name}
                </p>
                <p className="text-red-600 font-semibold font-mono">
                  ${Math.round(bestWorstAnalysis.highestCost.totalInterest).toLocaleString()} in interest
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-indigo-100">
                <p className="text-slate-600 text-xs font-medium uppercase tracking-wide mb-2">Interest Cost Spread</p>
                <p className="text-3xl font-bold text-red-600 font-mono">
                  ${Math.round(bestWorstAnalysis.costDifference).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-2">between the lowest and highest cost options</p>
              </div>
            </div>

            <div className="mt-6 p-5 bg-white rounded-xl shadow-sm border border-indigo-100">
              <p className="text-base text-slate-700 leading-relaxed">
                Across these scenarios, interest cost ranges from{' '}
                <span className="font-bold text-teal-600 font-mono">${Math.round(bestWorstAnalysis.lowestCost.totalInterest).toLocaleString()}</span>
                {' '}(<span style={{ color: bestWorstAnalysis.lowestCost.color }} className="font-semibold">{bestWorstAnalysis.lowestCost.name}</span>)
                {' '}to{' '}
                <span className="font-bold text-red-600 font-mono">${Math.round(bestWorstAnalysis.highestCost.totalInterest).toLocaleString()}</span>
                {' '}(<span style={{ color: bestWorstAnalysis.highestCost.color }} className="font-semibold">{bestWorstAnalysis.highestCost.name}</span>)
                {' '}— a difference of{' '}
                <span className="font-bold font-mono">${Math.round(bestWorstAnalysis.costDifference).toLocaleString()}</span>.
                {' '}Monthly payments range from{' '}
                <span className="font-bold font-mono">${Math.round(bestWorstAnalysis.lowestPayment.monthlyPayment).toLocaleString()}</span>
                {' '}to{' '}
                <span className="font-bold font-mono">${Math.round(bestWorstAnalysis.highestPayment.monthlyPayment).toLocaleString()}/mo</span>.
                {' '}Lower monthly payment means more paid in interest over time. Higher payment builds equity faster and costs less overall. Which trade-off fits your situation is yours to decide.
              </p>
            </div>
          </div>
        )}

        <div className="animate-in delay-600 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-slate-300 text-sm border border-slate-700">
          <p className="font-semibold text-white mb-3 text-base">Important Notes</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>All calculations show principal and interest only</li>
            <li>Actual monthly payments include property taxes, homeowner's insurance, and PMI (required when down payment is below 20%)</li>
            <li>Accelerated scenarios show the effect of making higher payments on a longer-term loan</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
