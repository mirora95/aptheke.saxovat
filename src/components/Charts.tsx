import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card } from './UI';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface DataItem { name: string; value: number; }

export const BarChartCard: React.FC<{ title: string; data: DataItem[]; hint?: string }> = ({ title, data, hint }) => (
  <Card className="p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
    {hint ? <p className="text-sm text-gray-500 mb-4">{hint}</p> : null}
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
        <Tooltip />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </Card>
);

export const PieChartCard: React.FC<{ title: string; data: DataItem[]; hint?: string }> = ({ title, data, hint }) => (
  <Card className="p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
    {hint ? <p className="text-sm text-gray-500 mb-4">{hint}</p> : null}
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
          {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </Card>
);

export const DonutChartCard: React.FC<{ title: string; data: DataItem[]; centerText?: string; hint?: string }> = ({ title, data, centerText, hint }) => (
  <Card className="p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
    {hint ? <p className="text-sm text-gray-500 mb-4">{hint}</p> : null}
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
            {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      {centerText ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-900">{centerText}</span>
        </div>
      ) : null}
    </div>
  </Card>
);
