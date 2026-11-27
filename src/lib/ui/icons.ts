/** Icon name → Lucide component (one import per icon: only these are bundled). */
import type { Component } from "svelte";
import type { IconName } from "./iconNames";
import House from "@lucide/svelte/icons/house";
import ListChecks from "@lucide/svelte/icons/list-checks";
import Calendar from "@lucide/svelte/icons/calendar";
import NotebookPen from "@lucide/svelte/icons/notebook-pen";
import Activity from "@lucide/svelte/icons/activity";
import SquareTerminal from "@lucide/svelte/icons/square-terminal";
import Settings from "@lucide/svelte/icons/settings";
import Flame from "@lucide/svelte/icons/flame";
import Pin from "@lucide/svelte/icons/pin";
import FileText from "@lucide/svelte/icons/file-text";
import Folder from "@lucide/svelte/icons/folder";
import FolderPlus from "@lucide/svelte/icons/folder-plus";
import ChartColumn from "@lucide/svelte/icons/chart-column";
import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
import SquareCheck from "@lucide/svelte/icons/square-check";
import Plus from "@lucide/svelte/icons/plus";
import X from "@lucide/svelte/icons/x";
import Trash2 from "@lucide/svelte/icons/trash-2";
import ChevronLeft from "@lucide/svelte/icons/chevron-left";
import ChevronRight from "@lucide/svelte/icons/chevron-right";
import ChevronDown from "@lucide/svelte/icons/chevron-down";
import Check from "@lucide/svelte/icons/check";
import ExternalLink from "@lucide/svelte/icons/external-link";
import AlarmClock from "@lucide/svelte/icons/alarm-clock";
import CalendarClock from "@lucide/svelte/icons/calendar-clock";
import ArrowRight from "@lucide/svelte/icons/arrow-right";
import CornerDownLeft from "@lucide/svelte/icons/corner-down-left";
import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
import Footprints from "@lucide/svelte/icons/footprints";
import GraduationCap from "@lucide/svelte/icons/graduation-cap";
import ChefHat from "@lucide/svelte/icons/chef-hat";
import ShoppingBag from "@lucide/svelte/icons/shopping-bag";
import Code from "@lucide/svelte/icons/code";
import CircleCheck from "@lucide/svelte/icons/circle-check";
import CircleAlert from "@lucide/svelte/icons/circle-alert";
import Info from "@lucide/svelte/icons/info";
import Square from "@lucide/svelte/icons/square";
import Sparkles from "@lucide/svelte/icons/sparkles";
import GripVertical from "@lucide/svelte/icons/grip-vertical";
import MapPin from "@lucide/svelte/icons/map-pin";
import Bell from "@lucide/svelte/icons/bell";
import BookOpen from "@lucide/svelte/icons/book-open";
import Music from "@lucide/svelte/icons/music";
import Dumbbell from "@lucide/svelte/icons/dumbbell";
import Bike from "@lucide/svelte/icons/bike";
import Wallet from "@lucide/svelte/icons/wallet";
import Utensils from "@lucide/svelte/icons/utensils";
import Coffee from "@lucide/svelte/icons/coffee";
import Moon from "@lucide/svelte/icons/moon";
import Droplet from "@lucide/svelte/icons/droplet";
import Gamepad2 from "@lucide/svelte/icons/gamepad-2";
import Heart from "@lucide/svelte/icons/heart";
import Briefcase from "@lucide/svelte/icons/briefcase";
import Plane from "@lucide/svelte/icons/plane";
import Car from "@lucide/svelte/icons/car";
import Tag from "@lucide/svelte/icons/tag";
import Search from "@lucide/svelte/icons/search";
import KeyRound from "@lucide/svelte/icons/key-round";
import GripHorizontal from "@lucide/svelte/icons/grip-horizontal";
import Maximize2 from "@lucide/svelte/icons/maximize-2";
import PictureInPicture2 from "@lucide/svelte/icons/picture-in-picture-2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ICONS: Record<IconName, Component<any>> = {
  "house": House,
  "list-checks": ListChecks,
  "calendar": Calendar,
  "notebook-pen": NotebookPen,
  "activity": Activity,
  "square-terminal": SquareTerminal,
  "settings": Settings,
  "flame": Flame,
  "pin": Pin,
  "file-text": FileText,
  "folder": Folder,
  "folder-plus": FolderPlus,
  "chart-column": ChartColumn,
  "circle-question-mark": CircleQuestionMark,
  "square-check": SquareCheck,
  "plus": Plus,
  "x": X,
  "trash-2": Trash2,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-down": ChevronDown,
  "check": Check,
  "external-link": ExternalLink,
  "alarm-clock": AlarmClock,
  "calendar-clock": CalendarClock,
  "arrow-right": ArrowRight,
  "corner-down-left": CornerDownLeft,
  "layout-dashboard": LayoutDashboard,
  "footprints": Footprints,
  "graduation-cap": GraduationCap,
  "chef-hat": ChefHat,
  "shopping-bag": ShoppingBag,
  "code": Code,
  "circle-check": CircleCheck,
  "circle-alert": CircleAlert,
  "info": Info,
  "square": Square,
  "sparkles": Sparkles,
  "grip-vertical": GripVertical,
  "map-pin": MapPin,
  "bell": Bell,
  "book-open": BookOpen,
  "music": Music,
  "dumbbell": Dumbbell,
  "bike": Bike,
  "wallet": Wallet,
  "utensils": Utensils,
  "coffee": Coffee,
  "moon": Moon,
  "droplet": Droplet,
  "gamepad-2": Gamepad2,
  "heart": Heart,
  "briefcase": Briefcase,
  "plane": Plane,
  "car": Car,
  "tag": Tag,
  "search": Search,
  "key-round": KeyRound,
  "grip-horizontal": GripHorizontal,
  "maximize-2": Maximize2,
  "picture-in-picture-2": PictureInPicture2,
};
