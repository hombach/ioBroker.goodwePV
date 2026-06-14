"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const utils = __importStar(require("@iobroker/adapter-core"));
const goodWeUdp_js_1 = require("./lib/goodWeUdp.js");
const projectUtils_js_1 = require("./lib/projectUtils.js");
class Goodwe extends utils.Adapter {
    inverter = new goodWeUdp_js_1.GoodWeUdp(this);
    projectUtils = new projectUtils_js_1.ProjectUtils(this);
    tmrTimeout;
    cycleCnt = 0;
    constructor(options = {}) {
        super({ ...options, name: "goodwe-pv" });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    async onReady() {
        void this.setState("info.connection", false, true);
        this.inverter.Connect(this.config.ipAddr, 8899);
        this.myTimer();
        const pwResult = await this.checkPasswordAsync("admin", "iobroker");
        this.log.info(`check user admin pw iobroker: ${String(pwResult)}`);
        const groupResult = await this.checkGroupAsync("admin", "admin");
        this.log.info(`check group user admin group admin: ${String(groupResult)}`);
    }
    onUnload(callback) {
        try {
            this.clearTimeout(this.tmrTimeout);
            callback();
        }
        catch {
            callback();
        }
    }
    onStateChange(id, state) {
        if (state) {
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
        else {
            this.log.info(`state ${id} deleted`);
        }
    }
    async updateDeviceInfo() {
        this.inverter.ReadDeviceInfo();
        const di = this.inverter.DeviceInfo;
        await this.projectUtils.checkAndSetChannel("DeviceInfo", "DeviceInfo");
        await this.projectUtils.checkAndSetValueNumber("DeviceInfo.ModbusProtocolVersion", di.ModbusProtocolVersion);
        await this.projectUtils.checkAndSetValueNumber("DeviceInfo.RatedPower", di.RatedPower);
        await this.projectUtils.checkAndSetValueNumber("DeviceInfo.AcOutputType", di.AcOutputType);
        await this.projectUtils.checkAndSetValue("DeviceInfo.SerialNumber", di.SerialNumber);
        await this.projectUtils.checkAndSetValue("DeviceInfo.DeviceType", di.DeviceType);
        await this.projectUtils.checkAndSetValueNumber("DeviceInfo.DSP1_SW_Version", di.DSP1_SoftwareVersion);
        await this.projectUtils.checkAndSetValueNumber("DeviceInfo.DSP2_SW_Version", di.DSP2_SoftwareVersion);
        await this.projectUtils.checkAndSetValueNumber("DeviceInfo.DSP_SVN_Version", di.DSP_SVN_Version);
        await this.projectUtils.checkAndSetValueNumber("DeviceInfo.ARM_SW_Version", di.ARM_SoftwareVersion);
        await this.projectUtils.checkAndSetValueNumber("DeviceInfo.ARM_SVN_Version", di.ARM_SVN_Version);
        await this.projectUtils.checkAndSetValue("DeviceInfo.DSP_Int_FW_Version", di.DSP_IntFirmwareVersion);
        await this.projectUtils.checkAndSetValue("DeviceInfo.ARM_Int_FW_Version", di.ARM_IntFirmwareVersion);
        void this.setStateAsync("info.connection", this.inverter.Status, true);
    }
    async updateRunningData() {
        this.inverter.ReadRunningData();
        const rd = this.inverter.RunningData;
        await this.projectUtils.checkAndSetChannel("RunningData", "RunningData");
        await this.projectUtils.updateDcParameters("RunningData", "PV1", rd.Pv1.Voltage, rd.Pv1.Current, rd.Pv1.Power, rd.Pv1.Mode);
        await this.projectUtils.updateDcParameters("RunningData", "PV2", rd.Pv2.Voltage, rd.Pv2.Current, rd.Pv2.Power, rd.Pv2.Mode);
        await this.projectUtils.updateDcParameters("RunningData", "PV3", rd.Pv3.Voltage, rd.Pv3.Current, rd.Pv3.Power, rd.Pv3.Mode);
        await this.projectUtils.updateDcParameters("RunningData", "PV4", rd.Pv4.Voltage, rd.Pv4.Current, rd.Pv4.Power, rd.Pv4.Mode);
        await this.projectUtils.updateAcPhase("RunningData", "GridL1", rd.GridL1.Voltage, rd.GridL1.Current, rd.GridL1.Frequency, rd.GridL1.Power);
        await this.projectUtils.updateAcPhase("RunningData", "GridL2", rd.GridL2.Voltage, rd.GridL2.Current, rd.GridL2.Frequency, rd.GridL2.Power);
        await this.projectUtils.updateAcPhase("RunningData", "GridL3", rd.GridL3.Voltage, rd.GridL3.Current, rd.GridL3.Frequency, rd.GridL3.Power);
        await this.projectUtils.checkAndSetValueNumber("RunningData.GridMode", rd.GridMode);
        await this.projectUtils.checkAndSetValueNumber("RunningData.InverterTotalPower", rd.InverterTotalPower);
        await this.projectUtils.checkAndSetValueNumber("RunningData.AcActivePower", rd.AcActivePower);
        await this.projectUtils.checkAndSetValueNumber("RunningData.AcReactivePower", rd.AcReactivePower);
        await this.projectUtils.checkAndSetValueNumber("RunningData.AcApparentPower", rd.AcApparentPower);
        await this.projectUtils.updateAcPhaseBackup("RunningData", "BackUpL1", rd.BackUpL1.Voltage, rd.BackUpL1.Current, rd.BackUpL1.Frequency, rd.BackUpL1.Power, rd.BackUpL1.Mode);
        await this.projectUtils.updateAcPhaseBackup("RunningData", "BackUpL2", rd.BackUpL2.Voltage, rd.BackUpL2.Current, rd.BackUpL2.Frequency, rd.BackUpL2.Power, rd.BackUpL2.Mode);
        await this.projectUtils.updateAcPhaseBackup("RunningData", "BackUpL3", rd.BackUpL3.Voltage, rd.BackUpL3.Current, rd.BackUpL3.Frequency, rd.BackUpL3.Power, rd.BackUpL3.Mode);
        await this.projectUtils.checkAndSetValueNumber("RunningData.PowerL1", rd.PowerL1);
        await this.projectUtils.checkAndSetValueNumber("RunningData.PowerL2", rd.PowerL2);
        await this.projectUtils.checkAndSetValueNumber("RunningData.PowerL3", rd.PowerL3);
        await this.projectUtils.checkAndSetValueNumber("RunningData.TotalPowerBackUp", rd.TotalPowerBackUp);
        await this.projectUtils.checkAndSetValueNumber("RunningData.TotalPower", rd.TotalPower);
        await this.projectUtils.checkAndSetValueNumber("RunningData.UpsLoadPercent", rd.UpsLoadPercent);
        await this.projectUtils.checkAndSetValueNumber("RunningData.AirTemperature", rd.AirTemperature);
        await this.projectUtils.checkAndSetValueNumber("RunningData.ModulTemperature", rd.ModulTemperature);
        await this.projectUtils.checkAndSetValueNumber("RunningData.RadiatorTemperature", rd.RadiatorTemperature);
        await this.projectUtils.checkAndSetValueNumber("RunningData.FunctionBitValue", rd.FunctionBitValue);
        await this.projectUtils.checkAndSetValueNumber("RunningData.BusVoltage", rd.BusVoltage);
        await this.projectUtils.checkAndSetValueNumber("RunningData.NbusVoltage", rd.NbusVoltage);
        await this.projectUtils.updateDcParameters("RunningData", "Battery1", rd.Battery1.Voltage, rd.Battery1.Current, rd.Battery1.Power, rd.Battery1.Mode);
        await this.projectUtils.checkAndSetValueNumber("RunningData.WarningCode", rd.WarningCode);
        await this.projectUtils.checkAndSetValueNumber("RunningData.SaftyCountry", rd.SaftyCountry);
        await this.projectUtils.checkAndSetValueNumber("RunningData.WorkMode", rd.WorkMode);
        await this.projectUtils.checkAndSetValueNumber("RunningData.OperationMode", rd.OperationMode);
        await this.projectUtils.checkAndSetValueNumber("RunningData.ErrorMessage", rd.ErrorMessage);
        await this.projectUtils.checkAndSetValueNumber("RunningData.PvEnergyTotal", rd.PvEnergyTotal);
        await this.projectUtils.checkAndSetValueNumber("RunningData.PvEnergyDay", rd.PvEnergyDay);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyTotal", rd.EnergyTotal);
        await this.projectUtils.checkAndSetValueNumber("RunningData.HoursTotal", rd.HoursTotal);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyDaySell", rd.EnergyDaySell);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyTotalBuy", rd.EnergyTotalBuy);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyDayBuy", rd.EnergyDayBuy);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyTotalLoad", rd.EnergyTotalLoad);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyDayLoad", rd.EnergyDayLoad);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyBatteryCharge", rd.EnergyBatteryCharge);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyDayCharge", rd.EnergyDayCharge);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyBatteryDischarge", rd.EnergyBatteryDischarge);
        await this.projectUtils.checkAndSetValueNumber("RunningData.EnergyDayDischarge", rd.EnergyDayDischarge);
        await this.projectUtils.checkAndSetValueNumber("RunningData.BatteryStrings", rd.BatteryStrings);
        await this.projectUtils.checkAndSetValueNumber("RunningData.CpldWarningCode", rd.CpldWarningCode);
        await this.projectUtils.checkAndSetValueNumber("RunningData.WChargeCtrFlag", rd.WChargeCtrFlag);
        await this.projectUtils.checkAndSetValueNumber("RunningData.DerateFrozenPower", rd.DerateFrozenPower);
        await this.projectUtils.checkAndSetValueNumber("RunningData.DiagStatusH", rd.DiagStatusH);
        await this.projectUtils.checkAndSetValueNumber("RunningData.DiagStatusL", rd.DiagStatusL);
        await this.projectUtils.checkAndSetValueNumber("RunningData.TotalPowerPv", rd.TotalPowerPv);
    }
    async updateExtComData() {
        this.inverter.ReadExtComData();
        const ec = this.inverter.ExtComData;
        await this.projectUtils.checkAndSetChannel("ExtComData", "ExtComData");
        await this.projectUtils.checkAndSetValueNumber("ExtComData.Commode", ec.Commode);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.Rssi", ec.Rssi);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.ManufacturerCode", ec.ManufacturerCode);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.MeterConnectStatus", ec.MeterConnectStatus);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.MeterCommunicateStatus", ec.MeterCommunicateStatus);
        await this.projectUtils.updateMeterPhase("ExtComData", "L1", ec.L1.ActivePower, ec.L1.PowerFactor);
        await this.projectUtils.updateMeterPhase("ExtComData", "L2", ec.L2.ActivePower, ec.L2.PowerFactor);
        await this.projectUtils.updateMeterPhase("ExtComData", "L3", ec.L3.ActivePower, ec.L3.PowerFactor);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.TotalActivePower", ec.TotalActivePower);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.TotalReactivePower", ec.TotalReactivePower);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.PowerFactor", ec.PowerFactor);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.Frequency", ec.Frequency);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.EnergyTotalSell", ec.EnergyTotalSell);
        await this.projectUtils.checkAndSetValueNumber("ExtComData.EnergyTotalBuy", ec.EnergyTotalBuy);
    }
    async updateBmsInfo() {
        this.inverter.ReadBmsInfo();
        const bms = this.inverter.BmsInfo;
        await this.projectUtils.checkAndSetChannel("BMSInfo", "BMSInfo");
        await this.projectUtils.checkAndSetValueNumber("BMSInfo.Status", bms.Status);
        await this.projectUtils.checkAndSetValueNumber("BMSInfo.PackTemperature", bms.PackTemperature);
        await this.projectUtils.checkAndSetValueNumber("BMSInfo.CurrentMaxCharge", bms.CurrentMaxCharge);
        await this.projectUtils.checkAndSetValueNumber("BMSInfo.CurrentMaxDischarge", bms.CurrentMaxDischarge);
        await this.projectUtils.checkAndSetValueNumber("BMSInfo.ErrorCode", bms.ErrorCode);
        await this.projectUtils.checkAndSetValueNumber("BMSInfo.SOC", bms.SOC);
        await this.projectUtils.checkAndSetValueNumber("BMSInfo.SOH", bms.SOH);
        await this.projectUtils.checkAndSetValueNumber("BMSInfo.BatteryStrings", bms.BatteryStrings);
    }
    myTimer() {
        if (!this.inverter.Status) {
            this.cycleCnt = 0;
            this.inverter.ReadIdInfo();
        }
        else {
            switch (this.cycleCnt) {
                case 1:
                    void this.updateDeviceInfo();
                    break;
                case 3:
                    void this.updateRunningData();
                    break;
                case 5:
                    void this.updateExtComData();
                    break;
                case 7:
                    void this.updateBmsInfo();
                    break;
            }
            if (this.cycleCnt >= this.config.pollCycle) {
                this.cycleCnt = 0;
            }
            this.cycleCnt++;
        }
        this.tmrTimeout = this.setTimeout(() => this.myTimer(), 1000);
    }
}
if (require.main !== module) {
    module.exports = (options) => new Goodwe(options);
}
else {
    new Goodwe();
}
module.exports = Goodwe;
//# sourceMappingURL=main.js.map