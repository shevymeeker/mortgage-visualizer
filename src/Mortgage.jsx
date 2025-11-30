import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function MortgageAnalyzer() {
  const [housePrice, setHousePrice] = useState(200000);
  const [downPaymentPercent, setDownPaymentPercent] = useState(5);
  const [selectedView, setSelectedView] = useState('overview');
  const [highlightedScenario, setHighlightedScenario] = useState(null);
  
  // Preset scenarios from the document
  const presetScenarios = [
    { id: 1, name: '30-Yr Standard', term: 30, rate: 6.3, accelerated: false, targetYears: null, color: '#3b82f6' },
    { id: 2, name: '20-Yr Standard', term: 20, rate: 6.0, accelerated: false, targetYears: null, color: '#10b981' },
    { id: 3, name: '50-Yr Standard', term: 50, rate: 6.8, accelerated: false, targetYears: null, color: '#ef4444' },
    { id: 4, name: '50-Yr (Paid in 30)', term: 50, rate: 6.8, accelerated: true, targetYears: 30, color: '#f59e0b' },
    { id: 5, name: '30-Yr (Paid in 20)', term: 30, rate: 6.3, accelerated: true, targetYears: 20, color: '#8b5cf6' },
    { id: 6, name: '50-Yr Accelerated', term: 50, rate: 6.8, accelerated: true, targetYears: 36.46, color: '#ec4899' },
    { id: 7, name: '50-Yr (3.5% Down)', term: 50, rate: 6.8, accelerated: false, targetYears: null, color: '#14b8a6', specialDown: 3.5 },
  ];

  const [activeScenarios, setActiveScenarios] = useState([1, 2, 3]);

  const calculateMortgage = (principal, annualRate, years, acceleratedTargetYears = null) => {
    // Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    // Where: M = monthly payment, P = principal, r = monthly rate, n = number of payments
    const monthlyRate = annualRate / 100 / 12;
    const numPayments = years * 12;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

    if (acceleratedTargetYears) {
      // Calculate accelerated payoff: same loan, but paid off in fewer years
      const targetPayments = acceleratedTargetYears * 12;

      // Calculate the higher monthly payment needed to pay off in target years
      const targetMonthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, targetPayments)) / (Math.pow(1 + monthlyRate, targetPayments) - 1);

      // Iterate through each payment to calculate exact interest/principal split
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
  }, [activeScenarios, housePrice, downPaymentPercent]);

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
    // Generate year-by-year amortization breakdown
    // Each payment splits into: Interest (on remaining balance) + Principal (reduces balance)
    const schedule = [];
    const monthlyRate = result.rate / 100 / 12;
    let balance = result.principal;

    for (let year = 0; year <= Math.ceil(result.actualTerm); year++) {
      const monthsInYear = year === Math.ceil(result.actualTerm) ? (result.actualTerm % 1) * 12 : 12;
      let yearPrincipal = 0;
      let yearInterest = 0;

      for (let month = 0; month < monthsInYear && balance > 0; month++) {
        const interestPayment = balance * monthlyRate; // Interest accrues on current balance
        const principalPayment = Math.min(result.monthlyPayment - interestPayment, balance); // Rest goes to principal
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

  const comparisonData = useMemo(() => {
    return results.map(r => ({
      name: r.name,
      'Monthly P&I': Math.round(r.monthlyPayment),
      'Total Interest': Math.round(r.totalInterest),
      'Total Cost': Math.round(r.totalPaid),
      'Principal': Math.round(r.principal),
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
          const schedule = generateAmortizationSchedule(result);
          const yearData = schedule.find(s => s.year === year);
          if (yearData) {
            point[result.name] = Math.round(yearData.balance);
          }
        }
      });
      
      data.push(point);
    }
    
    return data;
  }, [results]);

  const equityBuildupData = useMemo(() => {
    if (results.length === 0) return [];
    
    const maxTerm = Math.max(...results.map(r => r.actualTerm));
    const data = [];
    
    for (let year = 0; year <= maxTerm; year += 2) {
      const point = { year };
      
      results.forEach(result => {
        const equity = result.principal;
        if (year <= result.actualTerm) {
          const schedule = generateAmortizationSchedule(result);
          const yearData = schedule.find(s => s.year === year);
          if (yearData) {
            point[result.name] = Math.round(equity - yearData.balance);
          }
        } else {
          point[result.name] = Math.round(equity);
        }
      });
      
      data.push(point);
    }
    
    return data;
  }, [results]);

  const bestWorstAnalysis = useMemo(() => {
    if (results.length === 0) return null;
    
    const lowestPayment = results.reduce((min, r) => r.monthlyPayment < min.monthlyPayment ? r : min);
    const lowestCost = results.reduce((min, r) => r.totalInterest < min.totalInterest ? r : min);
    const highestCost = results.reduce((max, r) => r.totalInterest > max.totalInterest ? r : max);
    const costDifference = highestCost.totalInterest - lowestCost.totalInterest;
    
    return {
      lowestPayment,
      lowestCost,
      highestCost,
      costDifference
    };
  }, [results]);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Mortgage Strategy Analyzer</h1>
          <p className="text-slate-600">Comprehensive comparison of seven mortgage scenarios with real-time calculations. All figures show Principal and Interest only.</p>
        </div>

        {/* Loan Parameters */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Base Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">House Price</label>
                <span className="text-sm font-bold text-slate-900">${housePrice.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="50000"
                max="1000000"
                step="10000"
                value={housePrice}
                onChange={(e) => setHousePrice(parseInt(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Standard Down Payment</label>
                <span className="text-sm font-bold text-slate-900">{downPaymentPercent}% (${((downPaymentPercent / 100) * housePrice).toLocaleString()})</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={downPaymentPercent}
                onChange={(e) => setDownPaymentPercent(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Scenario Selection */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Select Scenarios to Compare</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {presetScenarios.map(scenario => (
              <button
                key={scenario.id}
                onClick={() => toggleScenario(scenario.id)}
                onMouseEnter={() => setHighlightedScenario(scenario.id)}
                onMouseLeave={() => setHighlightedScenario(null)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  activeScenarios.includes(scenario.id)
                    ? 'border-slate-900 bg-slate-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
                style={{
                  borderColor: activeScenarios.includes(scenario.id) ? scenario.color : undefined
                }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: scenario.color }}
                  />
                  <span className="text-sm font-medium text-slate-900 text-left">{scenario.name}</span>
                </div>
                <div className="mt-2 text-xs text-slate-600 text-left">
                  {scenario.term}yr @ {scenario.rate}%
                  {scenario.accelerated && ` → ${scenario.targetYears}yr`}
                  {scenario.specialDown && ` (${scenario.specialDown}% down)`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* View Selector */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
          <div className="flex flex-wrap gap-2">
            {['overview', 'payments', 'costs', 'equity', 'amortization'].map(view => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  selectedView === view
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Comparison Table */}
        {selectedView === 'overview' && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 overflow-hidden">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Complete Scenario Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Scenario</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Term</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Rate</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Principal</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Monthly P&I</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Total Paid</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Total Interest</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, idx) => (
                    <tr 
                      key={idx} 
                      className={`border-b border-slate-200 transition-colors ${
                        highlightedScenario === result.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 font-medium" style={{ color: result.color }}>
                        {result.name}
                      </td>
                      <td className="text-right py-3 px-4">
                        {result.term}yr
                        {result.accelerated && (
                          <span className="text-xs text-slate-500 ml-1">→ {result.actualTerm}yr</span>
                        )}
                      </td>
                      <td className="text-right py-3 px-4">{result.rate}%</td>
                      <td className="text-right py-3 px-4 text-slate-600">
                        ${result.principal.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold">
                        ${result.monthlyPayment.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className="text-right py-3 px-4">
                        ${result.totalPaid.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-red-600">
                        ${result.totalInterest.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Monthly Payments View */}
        {selectedView === 'payments' && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Monthly Payment Comparison</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} angle={-15} textAnchor="end" height={80} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} label={{ value: 'Monthly Payment ($)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  formatter={(value) => `$${value.toLocaleString()}`}
                />
                <Bar dataKey="Monthly P&I" radius={[8, 8, 0, 0]}>
                  {comparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Total Costs View */}
        {selectedView === 'costs' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Total Cost Breakdown</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    formatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <Legend />
                  <Bar dataKey="Principal" stackId="a" fill="#10b981" />
                  <Bar dataKey="Total Interest" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Interest Cost Comparison</h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} angle={-15} textAnchor="end" height={80} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} label={{ value: 'Total Interest ($)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    formatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <Bar dataKey="Total Interest" radius={[8, 8, 0, 0]}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Equity View */}
        {selectedView === 'equity' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Equity Buildup Over Time</h2>
              <ResponsiveContainer width="100%" height={450}>
                <LineChart data={equityBuildupData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="year" 
                    label={{ value: 'Years', position: 'insideBottom', offset: -5, fill: '#64748b' }}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: 'Equity Built ($)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
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

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Remaining Balance Over Time</h2>
              <ResponsiveContainer width="100%" height={450}>
                <LineChart data={balanceOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="year" 
                    label={{ value: 'Years', position: 'insideBottom', offset: -5, fill: '#64748b' }}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: 'Remaining Balance ($)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
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

        {/* Amortization View */}
        {selectedView === 'amortization' && results.length > 0 && (
          <div className="space-y-6">
            {results.map((result, idx) => {
              const schedule = generateAmortizationSchedule(result);
              const scheduleData = schedule.slice(0, 11).map(s => ({
                year: s.year,
                'Principal Paid': Math.round(s.principalPaid),
                'Interest Paid': Math.round(s.interestPaid),
                'Remaining Balance': Math.round(s.balance)
              }));

              return (
                <div key={idx} className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                  <h2 className="text-xl font-semibold text-slate-900 mb-4" style={{ color: result.color }}>
                    {result.name} - Year-by-Year Breakdown
                  </h2>
                  <div className="mb-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={scheduleData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                        <YAxis label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                        <Legend />
                        <Bar dataKey="Principal Paid" stackId="a" fill="#10b981" />
                        <Bar dataKey="Interest Paid" stackId="a" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold text-slate-700">Year</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Principal Paid</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Interest Paid</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Total Paid</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-700">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.slice(0, 11).map((s, i) => (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="py-2 px-3">{s.year}</td>
                            <td className="text-right py-2 px-3 text-green-600">
                              ${s.principalPaid.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </td>
                            <td className="text-right py-2 px-3 text-red-600">
                              ${s.interestPaid.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </td>
                            <td className="text-right py-2 px-3">
                              ${s.totalPaid.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </td>
                            <td className="text-right py-2 px-3 font-semibold">
                              ${s.balance.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {schedule.length > 11 && (
                    <p className="text-sm text-slate-500 mt-2">Showing first 10 years. Full term: {result.actualTerm} years.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Analysis Summary */}
        {bestWorstAnalysis && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Strategic Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-slate-600 mb-1">Lowest Monthly Payment</p>
                <p className="font-bold text-lg" style={{ color: bestWorstAnalysis.lowestPayment.color }}>
                  {bestWorstAnalysis.lowestPayment.name}
                </p>
                <p className="text-slate-900 font-semibold">
                  ${Math.round(bestWorstAnalysis.lowestPayment.monthlyPayment).toLocaleString()}/month
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-slate-600 mb-1">Lowest Total Cost</p>
                <p className="font-bold text-lg" style={{ color: bestWorstAnalysis.lowestCost.color }}>
                  {bestWorstAnalysis.lowestCost.name}
                </p>
                <p className="text-green-600 font-semibold">
                  ${Math.round(bestWorstAnalysis.lowestCost.totalInterest).toLocaleString()} in interest
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-slate-600 mb-1">Highest Total Cost</p>
                <p className="font-bold text-lg" style={{ color: bestWorstAnalysis.highestCost.color }}>
                  {bestWorstAnalysis.highestCost.name}
                </p>
                <p className="text-red-600 font-semibold">
                  ${Math.round(bestWorstAnalysis.highestCost.totalInterest).toLocaleString()} in interest
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-slate-600 mb-1">Cost Difference (Best vs Worst)</p>
                <p className="text-2xl font-bold text-red-600">
                  ${Math.round(bestWorstAnalysis.costDifference).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">Potential savings by choosing optimal strategy</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg shadow-sm">
              <p className="text-sm text-slate-700 leading-relaxed">
                The data reveals the mathematical trap of extended-term mortgages. The lowest monthly payment appears attractive but costs 
                <span className="font-bold text-red-600"> ${Math.round(bestWorstAnalysis.costDifference).toLocaleString()} </span>
                more in total interest compared to the most efficient option. A shorter-term loan at a lower rate consistently delivers 
                the best outcome, building equity faster while paying substantially less interest over the life of the loan.
              </p>
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl p-6 text-slate-300 text-sm">
          <p className="font-semibold text-white mb-2">Important Notes</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>All calculations show Principal and Interest only</li>
            <li>Actual monthly payments include property taxes, insurance, and PMI (required for down payments below 20%)</li>
            <li>Scenario 7 uses 3.5% down payment instead of the standard {downPaymentPercent}%</li>
            <li>Accelerated scenarios show the effect of making higher payments on longer-term loans</li>
        
          </ul>
        </div>
      </div>
    </div>
  );
}
