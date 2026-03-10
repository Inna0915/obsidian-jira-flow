import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TFile } from "obsidian";
import type JiraFlowPlugin from "../main";
import type { ReportPeriod } from "../types";
import type { DailyWorkLog } from "../sync/workLogService";
import { WorkLogService } from "../sync/workLogService";
import { useEscapeKey } from "../hooks/useEscapeKey";

// ===== Lunar Calendar =====

const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06aa0, 0x1a6c4, 0x0aae0,
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
  0x0d520,
];

const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const SHENG_XIAO = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
const LUNAR_MONTH_CN = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const LUNAR_DAY_CN = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

const SOLAR_TERMS = [
  "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨",
  "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑",
  "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
];

const FESTIVALS: Record<string, string> = {
  "1-1": "元旦", "2-14": "情人节", "3-8": "妇女节", "4-1": "愚人节",
  "5-1": "劳动节", "6-1": "儿童节", "10-1": "国庆节", "12-25": "圣诞节",
};

const LUNAR_FESTIVALS: Record<string, string> = {
  "1-1": "春节", "1-15": "元宵节", "5-5": "端午节", "7-7": "七夕",
  "7-15": "中元节", "8-15": "中秋节", "9-9": "重阳节", "12-30": "除夕",
  "12-29": "除夕",
};

function lYearDays(y: number): number {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  return sum + leapDays(y);
}

function leapMonth(y: number): number {
  return LUNAR_INFO[y - 1900] & 0xf;
}

function leapDays(y: number): number {
  if (leapMonth(y)) return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
  return 0;
}

function monthDays(y: number, m: number): number {
  return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
}

interface LunarDate {
  year: number;
  month: number;
  day: number;
  isLeap: boolean;
  yearGanZhi: string;
  shengXiao: string;
  monthCn: string;
  dayCn: string;
  festival?: string;
}

function solarToLunar(solarYear: number, solarMonth: number, solarDay: number): LunarDate {
  const baseDate = new Date(1900, 0, 31);
  const objDate = new Date(solarYear, solarMonth - 1, solarDay);
  let offset = Math.floor((objDate.getTime() - baseDate.getTime()) / 86400000);

  let lunarYear = 1900;
  let temp = 0;
  for (lunarYear = 1900; lunarYear < 2101 && offset > 0; lunarYear++) {
    temp = lYearDays(lunarYear);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    lunarYear--;
  }

  const leap = leapMonth(lunarYear);
  let isLeap = false;
  let lunarMonth = 1;

  for (lunarMonth = 1; lunarMonth < 13 && offset > 0; lunarMonth++) {
    if (leap > 0 && lunarMonth === leap + 1 && !isLeap) {
      --lunarMonth;
      isLeap = true;
      temp = leapDays(lunarYear);
    } else {
      temp = monthDays(lunarYear, lunarMonth);
    }
    if (isLeap && lunarMonth === leap + 1) isLeap = false;
    offset -= temp;
  }

  if (offset === 0 && leap > 0 && lunarMonth === leap + 1) {
    if (isLeap) {
      isLeap = false;
    } else {
      isLeap = true;
      --lunarMonth;
    }
  }
  if (offset < 0) {
    offset += temp;
    --lunarMonth;
  }

  const lunarDay = offset + 1;
  const ganZhiIdx = (lunarYear - 4) % 60;
  const yearGanZhi = TIAN_GAN[ganZhiIdx % 10] + DI_ZHI[ganZhiIdx % 12];
  const shengXiao = SHENG_XIAO[(lunarYear - 4) % 12];
  const monthCn = (isLeap ? "闰" : "") + LUNAR_MONTH_CN[lunarMonth - 1] + "月";
  const dayCn = LUNAR_DAY_CN[lunarDay - 1];

  // Festival check
  const solarKey = `${solarMonth}-${solarDay}`;
  const lunarKey = `${lunarMonth}-${lunarDay}`;
  const festival = FESTIVALS[solarKey] || LUNAR_FESTIVALS[lunarKey];

  return { year: lunarYear, month: lunarMonth, day: lunarDay, isLeap, yearGanZhi, shengXiao, monthCn, dayCn, festival };
}

// ===== Date Helpers =====

function getWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function getIsoWeekInfo(d: Date): { year: number; week: number } {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  return { year: date.getFullYear(), week: getWeekNumber(date) };
}

function getWeekRangeForDate(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function getWeekRange(year: number, week: number): { start: Date; end: Date } {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
}

function getQuarterRange(year: number, month: number): { start: Date; end: Date } {
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return { start: new Date(year, quarterStartMonth, 1), end: new Date(year, quarterStartMonth + 3, 0) };
}

function getYearRange(year: number): { start: Date; end: Date } {
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
}

function getWeekKey(date: Date): string {
  const info = getIsoWeekInfo(date);
  return `${info.year}-W${String(info.week).padStart(2, "0")}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type ViewMode = "day" | "week" | "month" | "year";

const DAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];

// ===== Interfaces =====

interface ReportCenterProps {
  plugin: JiraFlowPlugin;
  onBack: () => void;
}

interface TaskItem {
  key: string;
  summary: string;
  status: string;
  issuetype: string;
  dueDate: string;
  completed: boolean;
  source: string;
}

// ===== Main Component =====

export const ReportCenter: React.FC<ReportCenterProps> = ({ plugin, onBack }) => {
  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(today);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [pendingTasks, setPendingTasks] = useState<TaskItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TaskItem[]>([]);
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [reportContent, setReportContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showReportModal, setShowReportModal] = useState<ReportPeriod | null>(null);
  const [savedReportContent, setSavedReportContent] = useState("");
  const [weekReportMap, setWeekReportMap] = useState<Set<string>>(new Set());

  const todayLunar = useMemo(() => solarToLunar(today.getFullYear(), today.getMonth() + 1, today.getDate()), [today]);

  // Get the date range for current view
  const viewRange = useMemo(() => {
    switch (viewMode) {
      case "day":
        return { start: new Date(selectedDate), end: new Date(selectedDate) };
      case "week": {
        const wn = getWeekNumber(selectedDate);
        return getWeekRange(selectedDate.getFullYear(), wn);
      }
      case "month":
        return getMonthRange(selectedDate.getFullYear(), selectedDate.getMonth());
      case "year":
        return getYearRange(selectedDate.getFullYear());
    }
  }, [viewMode, selectedDate]);

  const getRangeForReportPeriod = useCallback((period: ReportPeriod, baseDate: Date) => {
    switch (period) {
      case "weekly":
        return getWeekRangeForDate(baseDate);
      case "monthly":
        return getMonthRange(baseDate.getFullYear(), baseDate.getMonth());
      case "quarterly":
        return getQuarterRange(baseDate.getFullYear(), baseDate.getMonth());
      case "yearly":
        return getYearRange(baseDate.getFullYear());
    }
  }, []);

  const modalRange = useMemo(() => {
    if (!showReportModal) {
      return null;
    }
    return getRangeForReportPeriod(showReportModal, selectedDate);
  }, [getRangeForReportPeriod, selectedDate, showReportModal]);

  // Load tasks for the current view range
  useEffect(() => {
    const files = plugin.fileManager.getAllTaskFiles();
    const pending: TaskItem[] = [];
    const completed: TaskItem[] = [];
    const start = viewRange.start;
    const end = viewRange.end;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    for (const file of files) {
      const fm = plugin.fileManager.getTaskFrontmatter(file);
      if (!fm) continue;
      const isLocal = fm.source === "LOCAL";
      const hasActiveSprint = fm.sprint_state?.toUpperCase() === "ACTIVE";
      if (!isLocal && !hasActiveSprint) continue;

      const item: TaskItem = {
        key: fm.jira_key,
        summary: fm.summary,
        status: fm.mapped_column,
        issuetype: fm.issuetype,
        dueDate: fm.due_date,
        completed: ["DONE", "RESOLVED", "CLOSED", "EXECUTED"].includes(fm.mapped_column),
        source: fm.source,
      };

      // Filter by due date within range
      if (fm.due_date) {
        const dd = new Date(fm.due_date);
        if (dd >= start && dd <= end) {
          if (item.completed) completed.push(item);
          else pending.push(item);
          continue;
        }
      }
      // Also include tasks updated within range
      if (fm.updated) {
        const ud = new Date(fm.updated);
        if (ud >= start && ud <= end) {
          if (item.completed) completed.push(item);
          else pending.push(item);
        }
      }
    }

    setPendingTasks(pending);
    setCompletedTasks(completed);
  }, [viewRange, plugin]);

  // Load work logs for the view range
  useEffect(() => {
    (async () => {
      const wls = new WorkLogService(plugin);
      const logs = await wls.collectLogs(viewRange.start, viewRange.end);
      setWorkLogs(logs);
    })();
  }, [viewRange, plugin]);

  // Check which weeks have reports
  useEffect(() => {
    setWeekReportMap(plugin.reportGenerator.listReportKeys("weekly"));
  }, [plugin]);

  // Generate a template with correct dates for the selected period
  const generateReportTemplate = useCallback((period: ReportPeriod, start: Date, end: Date): string => {
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    const periodLabel = periodLabels[period];
    
    switch (period) {
      case "weekly":
        return `# 周报\n\n**周期:** ${startStr} ~ ${endStr}\n\n## 本周总结\n\n\n## 主要工作\n\n\n## 下周计划\n\n`;
      case "monthly":
        return `# 月报\n\n**周期:** ${startStr} ~ ${endStr}\n\n## 本月总结\n\n\n## 主要成果\n\n\n## 下月计划\n\n`;
      case "quarterly":
        return `# 季报\n\n**周期:** ${startStr} ~ ${endStr}\n\n## 本季度总结\n\n\n## 主要成果\n\n\n## 下季度计划\n\n`;
      case "yearly":
        return `# 年报\n\n**周期:** ${startStr} ~ ${endStr}\n\n## 年度总结\n\n\n## 主要成果\n\n\n## 明年计划\n\n`;
      default:
        return `# ${periodLabel}\n\n**周期:** ${startStr} ~ ${endStr}\n\n`;
    }
  }, []);

  // Load existing report for modal based on the selected date range
  useEffect(() => {
    if (!showReportModal) { setSavedReportContent(""); setReportContent(""); return; }
    (async () => {
      const targetRange = getRangeForReportPeriod(showReportModal, selectedDate);
      const matchingFile = plugin.reportGenerator.getReportFile(showReportModal, targetRange);

      if (matchingFile) {
        const content = await plugin.app.vault.read(matchingFile);
        setSavedReportContent(content);
        setReportContent(content);
      } else {
        // Generate a template with the correct dates instead of empty content
        const template = generateReportTemplate(showReportModal, targetRange.start, targetRange.end);
        setSavedReportContent("");
        setReportContent(template);
      }
    })();
  }, [showReportModal, plugin, selectedDate, getRangeForReportPeriod, generateReportTemplate]);

  const handleGenerate = useCallback(async (period: ReportPeriod) => {
    setGenerating(true);
    try {
      const targetRange = getRangeForReportPeriod(period, selectedDate);
      const result = await plugin.reportGenerator.generateReport(period, {
        start: targetRange.start,
        end: targetRange.end,
      });
      setReportContent(result.content);
      setSavedReportContent(result.content);
      setWeekReportMap(plugin.reportGenerator.listReportKeys("weekly"));
    } catch (e) {
      setReportContent(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  }, [getRangeForReportPeriod, plugin, selectedDate]);

  const handleRefresh = useCallback(() => {
    setSelectedDate(new Date(selectedDate));
  }, [selectedDate]);

  // Calendar grid for the current month
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
    const rows: Array<Array<{ date: Date; inMonth: boolean; lunar: LunarDate; weekNum: number }>> = [];
    let current = new Date(firstDay);
    current.setDate(current.getDate() - startDow);

    while (current <= lastDay || rows.length < 5) {
      const row: typeof rows[0] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(current);
        const lunar = solarToLunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
        row.push({
          date: d,
          inMonth: d.getMonth() === calMonth,
          lunar,
          weekNum: getWeekNumber(d),
        });
        current.setDate(current.getDate() + 1);
      }
      rows.push(row);
      if (current.getMonth() !== calMonth && rows.length >= 5) break;
    }
    return rows;
  }, [calYear, calMonth]);

  const viewTitle = useMemo(() => {
    switch (viewMode) {
      case "day":
        return `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;
      case "week":
        return `${getIsoWeekInfo(selectedDate).year}年第${getIsoWeekInfo(selectedDate).week}周`;
      case "month":
        return `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月`;
      case "year":
        return `${selectedDate.getFullYear()}年`;
    }
  }, [viewMode, selectedDate]);

  const viewBadge = useMemo(() => {
    const labels: Record<ViewMode, string> = { day: "日视图", week: "周视图", month: "月视图", year: "年视图" };
    return labels[viewMode];
  }, [viewMode]);

  const handleCalDateClick = useCallback((d: Date) => {
    setSelectedDate(d);
    setViewMode("day");
  }, []);

  const handleWeekClick = useCallback((date: Date) => {
    const range = getWeekRangeForDate(date);
    setSelectedDate(range.start);
    setViewMode("week");
  }, []);

  const handlePrevMonth = useCallback(() => {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
    else setCalMonth(calMonth - 1);
  }, [calYear, calMonth]);

  const handleNextMonth = useCallback(() => {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
    else setCalMonth(calMonth + 1);
  }, [calYear, calMonth]);

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "var(--font-interface)", color: "var(--text-normal)" }}>
      {/* Left Sidebar - Calendar */}
      <div style={{
        width: "260px", minWidth: "260px", borderRight: "1px solid var(--background-modifier-border)",
        display: "flex", flexDirection: "column", padding: "16px",
        backgroundColor: "var(--background-primary)",
      }}>
        {/* Lunar info */}
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          {todayLunar.yearGanZhi}年 · {todayLunar.monthCn}{todayLunar.dayCn}
          {todayLunar.festival && <span style={{ color: "#FF5630", marginLeft: "6px" }}>{todayLunar.festival}</span>}
        </div>

        {/* Month Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            <NavBtn onClick={() => { setCalYear(calYear - 1); }}>«</NavBtn>
            <NavBtn onClick={handlePrevMonth}>‹</NavBtn>
          </div>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{calYear}年{calMonth + 1}月</span>
          <div style={{ display: "flex", gap: "4px" }}>
            <NavBtn onClick={handleNextMonth}>›</NavBtn>
            <NavBtn onClick={() => { setCalYear(calYear + 1); }}>»</NavBtn>
          </div>
        </div>

        {/* Calendar Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "28px repeat(7, 1fr)", gap: "0", fontSize: "12px" }}>
          {/* Header */}
          <div style={{ ...calHeaderStyle }}>周</div>
          {DAY_NAMES.map((d) => (
            <div key={d} style={{ ...calHeaderStyle, color: d === "六" || d === "日" ? "#FF5630" : "var(--text-muted)" }}>{d}</div>
          ))}

          {/* Rows */}
          {calendarGrid.map((row, ri) => {
            const weekNum = row[0].weekNum;
            const isSelectedWeek = viewMode === "week" && getWeekNumber(selectedDate) === weekNum;
            const hasReport = weekReportMap.has(getWeekKey(row[0].date));
            return (
              <React.Fragment key={ri}>
                {/* Week number */}
                <div
                  onClick={() => handleWeekClick(row[0].date)}
                  style={{
                    ...calCellStyle, cursor: "pointer", fontSize: "10px", fontWeight: 600,
                    color: isSelectedWeek ? "#0052CC" : "var(--text-muted)",
                    position: "relative",
                  }}
                  title={`第${weekNum}周${hasReport ? " (有周报)" : ""}`}
                >
                  {weekNum}
                  {hasReport && <span style={{ position: "absolute", bottom: "1px", left: "50%", transform: "translateX(-50%)", width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "#36B37E" }} />}
                </div>
                {/* Days */}
                {row.map((cell, ci) => {
                  const isToday = isSameDay(cell.date, today);
                  const isSelected = isSameDay(cell.date, selectedDate) && viewMode === "day";
                  const isSun = ci === 6;
                  const isSat = ci === 5;
                  const hasFestival = !!cell.lunar.festival;
                  return (
                    <div
                      key={ci}
                      onClick={() => handleCalDateClick(cell.date)}
                      style={{
                        ...calCellStyle,
                        cursor: "pointer",
                        opacity: cell.inMonth ? 1 : 0.35,
                        backgroundColor: isSelected ? "#0052CC" : isToday ? "#0052CC18" : isSelectedWeek ? "#0052CC0A" : "transparent",
                        color: isSelected ? "#fff" : hasFestival ? "#FF5630" : (isSun || isSat) ? "#FF5630" : "var(--text-normal)",
                        borderRadius: "4px",
                        fontWeight: isToday ? 700 : 400,
                      }}
                    >
                      <div style={{ fontSize: "12px", lineHeight: 1.2 }}>{cell.date.getDate()}</div>
                      <div style={{ fontSize: "8px", lineHeight: 1, color: isSelected ? "#ffffffcc" : hasFestival ? "#FF5630" : "var(--text-faint)" }}>
                        {cell.lunar.festival || cell.lunar.dayCn}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        {/* View Mode Switcher */}
        <div style={{ display: "flex", gap: "4px", marginTop: "16px", flexWrap: "wrap" }}>
          {(["day", "week", "month", "year"] as ViewMode[]).map((m) => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              flex: 1, padding: "6px 0", borderRadius: "6px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: viewMode === m ? 700 : 400,
              backgroundColor: viewMode === m ? "#0052CC" : "var(--background-secondary)",
              color: viewMode === m ? "#fff" : "var(--text-muted)",
            }}>
              {{ day: "日", week: "周", month: "月", year: "年" }[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Right Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top Bar */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid var(--background-modifier-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Back to Board Button */}
            <button
              onClick={onBack}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--background-secondary)";
                e.currentTarget.style.color = "var(--text-normal)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
              title="返回看板"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>返回看板</span>
            </button>
            <div style={{ width: "1px", height: "24px", backgroundColor: "var(--background-modifier-border)", margin: "0 4px" }} />
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>{viewTitle}</h2>
            <span style={{
              fontSize: "11px", padding: "3px 10px", borderRadius: "12px",
              backgroundColor: "#0052CC18", color: "#0052CC", fontWeight: 600,
            }}>{viewBadge}</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <ReportBtn onClick={() => setShowReportModal("weekly")}>查看周报</ReportBtn>
            <ReportBtn onClick={() => setShowReportModal("monthly")}>查看月报</ReportBtn>
            <ReportBtn onClick={() => setShowReportModal("quarterly")}>查看季报</ReportBtn>
            <ReportBtn onClick={() => setShowReportModal("yearly")}>查看年报</ReportBtn>
            <ReportBtn onClick={handleRefresh}>刷新</ReportBtn>
          </div>
        </div>

        {/* Task Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* Pending Tasks */}
          <div style={{ marginBottom: "28px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
              预计完成任务 ({pendingTasks.length})
              <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-muted)", marginLeft: "8px" }}>
                截止日在{viewTitle}内
              </span>
            </h3>
            {pendingTasks.length === 0 ? (
              <EmptyState text="暂无预计完成的任务" sub="当前时间范围内没有截止的待完成任务" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {pendingTasks.map((t) => <TaskRow key={t.key} task={t} plugin={plugin} />)}
              </div>
            )}
          </div>

          {/* Completed Tasks */}
          <div style={{ marginBottom: "28px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
              已完成工作 ({completedTasks.length})
            </h3>
            {completedTasks.length === 0 ? (
              <EmptyState text="暂无工作日志" sub="在指定时间范围内没有找到记录" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {completedTasks.map((t) => <TaskRow key={t.key} task={t} plugin={plugin} />)}
              </div>
            )}
          </div>

          {/* Work Logs */}
          {workLogs.length > 0 && (
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>
                工作日志 ({workLogs.length}天)
              </h3>
              {workLogs.map((log) => (
                <div key={log.date} style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>{log.date}</div>
                  {log.entries.map((entry, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px",
                      fontSize: "13px", borderRadius: "4px", backgroundColor: "var(--background-secondary)", marginBottom: "3px",
                    }}>
                      <span style={{ color: entry.completed ? "#36B37E" : "var(--text-muted)" }}>
                        {entry.completed ? "✓" : "○"}
                      </span>
                      {entry.taskKey && <span style={{ fontFamily: "var(--font-monospace)", fontSize: "11px", color: "#0052CC" }}>{entry.taskKey}</span>}
                      <span>{entry.summary}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          plugin={plugin}
          period={showReportModal}
          content={reportContent}
          savedContent={savedReportContent}
          generating={generating}
          onGenerate={() => handleGenerate(showReportModal)}
          onClose={() => setShowReportModal(null)}
          viewTitle={viewTitle}
          dateRange={modalRange ?? viewRange}
        />
      )}
    </div>
  );
};

// ===== Sub-components =====

const NavBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} style={{
    width: "24px", height: "24px", border: "none", borderRadius: "4px", cursor: "pointer",
    backgroundColor: "transparent", color: "#0052CC", fontSize: "14px", fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>{children}</button>
);

const ReportBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} style={{
    padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--background-modifier-border)",
    backgroundColor: "transparent", cursor: "pointer", fontSize: "12px", color: "#0052CC", fontWeight: 500,
  }}>{children}</button>
);

const EmptyState: React.FC<{ text: string; sub: string }> = ({ text, sub }) => (
  <div style={{
    padding: "40px 20px", textAlign: "center", borderRadius: "8px",
    border: "1px solid var(--background-modifier-border)", backgroundColor: "var(--background-secondary)",
  }}>
    <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "4px" }}>{text}</div>
    <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>{sub}</div>
  </div>
);

const typeIconMap: Record<string, string> = {
  Bug: "🐛", Story: "📗", Task: "✅", "Sub-task": "📎", Epic: "⚡",
};

const TaskRow: React.FC<{ task: TaskItem; plugin: JiraFlowPlugin }> = ({ task, plugin }) => {
  const onHoverTask = (e: React.MouseEvent, taskKey: string) => {
    if (plugin?.app) {
      const targetFile = plugin.fileManager.findTaskFileByKey(taskKey);
      const linkText = targetFile ? targetFile.path : taskKey;

      plugin.app.workspace.trigger('hover-link', {
        event: e.nativeEvent,
        source: 'jira-flow-report',
        hoverParent: { hoverPopover: null, disabled: false },
        targetEl: e.currentTarget,
        linktext: linkText,
        sourcePath: ''
      });
    }
  };

  const onClickTask = async (taskKey: string) => {
    if (plugin?.app) {
      const targetFile = plugin.fileManager.findTaskFileByKey(taskKey);
      if (targetFile instanceof TFile) {
        await plugin.app.workspace.getLeaf('tab').openFile(targetFile);
      }
    }
  };

  return (
    <div 
      style={{
        display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px",
        borderRadius: "6px", backgroundColor: "var(--background-secondary)", fontSize: "13px",
        cursor: "pointer", transition: "background-color 0.15s ease",
      }}
      className="jf-hover:bg-[var(--background-modifier-hover)]"
      onClick={() => onClickTask(task.key)}
      onMouseEnter={(e) => onHoverTask(e, task.key)}
    >
      <span style={{ fontSize: "12px" }}>{typeIconMap[task.issuetype] || "📋"}</span>
      <span style={{ fontFamily: "var(--font-monospace)", fontSize: "11px", color: "#0052CC", fontWeight: 600, flexShrink: 0 }}>{task.key}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.summary}</span>
      <span style={{
        fontSize: "10px", padding: "2px 8px", borderRadius: "10px", fontWeight: 600, flexShrink: 0,
        backgroundColor: task.completed ? "#E3FCEF" : "#DEEBFF",
        color: task.completed ? "#006644" : "#0052CC",
      }}>{task.status}</span>
      {task.dueDate && <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>{task.dueDate.slice(0, 10)}</span>}
    </div>
  );
};

interface ReportModalProps {
  plugin: JiraFlowPlugin;
  period: ReportPeriod;
  content: string;
  savedContent: string;
  generating: boolean;
  onGenerate: () => void;
  onClose: () => void;
  viewTitle: string;
  dateRange: { start: Date; end: Date };
}

const periodLabels: Record<ReportPeriod, string> = {
  weekly: "周报", monthly: "月报", quarterly: "季报", yearly: "年报",
};

const ReportModal: React.FC<ReportModalProps> = ({ plugin, period, content, savedContent, generating, onGenerate, onClose, viewTitle, dateRange }) => {
  // Trap ESC key to close modal without closing Obsidian tab
  useEscapeKey(plugin.app, onClose, true);

  // Format the date range for display
  const dateRangeStr = `${formatDate(dateRange.start)} ~ ${formatDate(dateRange.end)}`;

  // Copy functionality
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  }, [content]);

  return (
  <>
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.3)" }} onClick={onClose} />
    <div style={{
      position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      zIndex: 10000, width: "700px", maxWidth: "90vw", maxHeight: "80vh",
      backgroundColor: "var(--background-primary)", borderRadius: "12px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "18px 24px", borderBottom: "1px solid var(--background-modifier-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{periodLabels[period]}</h3>
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{viewTitle}</span>
          <span style={{ 
            fontSize: "11px", 
            padding: "2px 8px", 
            borderRadius: "4px",
            backgroundColor: "var(--background-secondary)",
            color: "var(--text-faint)",
            fontFamily: "var(--font-monospace)",
          }}>{dateRangeStr}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button onClick={handleCopy} disabled={!content} title="复制内容" style={{
            background: copied ? "var(--background-secondary)" : "none",
            border: "none", cursor: content ? "pointer" : "not-allowed",
            fontSize: "14px", color: copied ? "var(--text-success)" : "var(--text-muted)",
            padding: "4px 10px", borderRadius: "4px", opacity: content ? 1 : 0.5,
          }}>{copied ? "已复制" : "复制"}</button>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--text-muted)", padding: "4px 8px",
          }}>✕</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {content ? (
          <div style={{
            fontSize: "13px", lineHeight: 1.8, whiteSpace: "pre-wrap",
            color: "var(--text-normal)",
          }}>{content}</div>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "8px" }}>
              暂无{periodLabels[period]}内容
            </div>
            <div style={{ 
              fontSize: "12px", 
              color: "var(--text-faint)",
              fontFamily: "var(--font-monospace)",
              padding: "8px 16px",
              backgroundColor: "var(--background-secondary)",
              borderRadius: "6px",
              display: "inline-block",
              marginBottom: "12px",
            }}>
              {dateRangeStr}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>
              点击下方按钮使用 AI 生成
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "14px 24px", borderTop: "1px solid var(--background-modifier-border)",
        display: "flex", justifyContent: "flex-end", gap: "8px",
      }}>
        <button onClick={onGenerate} disabled={generating} style={{
          padding: "8px 20px", borderRadius: "6px", border: "none", cursor: "pointer",
          backgroundColor: "#0052CC", color: "#fff", fontSize: "13px", fontWeight: 600,
          opacity: generating ? 0.6 : 1,
        }}>{generating ? "生成中..." : `使用 AI 生成${periodLabels[period]}`}</button>
      </div>
    </div>
  </>
  );
};

// ===== Styles =====

const calHeaderStyle: React.CSSProperties = {
  textAlign: "center", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
  padding: "4px 0",
};

const calCellStyle: React.CSSProperties = {
  textAlign: "center", padding: "3px 2px", minHeight: "36px",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
};
