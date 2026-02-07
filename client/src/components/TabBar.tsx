import type { Tab } from '../types';
import '../styles/TabBar.css';

interface TabBarProps {
  tabs: Tab[];
  activeTab: number;
  onTabChange: (tabId: number) => void;
}

export default function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tab-bar-scroll">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.name}
          </button>
        ))}
      </div>
    </div>
  );
}
