package com.myair.app.bridge

import com.myair.app.provider.CommandOutcome
import com.myair.app.provider.ProviderSnapshot
import org.json.JSONArray
import org.json.JSONObject

fun ProviderSnapshot.toJson(): String = JSONObject().apply {
    put("provider", provider)
    put("phase", phase.wire)
    put("message", message ?: JSONObject.NULL)
    put("devices", JSONArray().also { arr ->
        devices.forEach { d ->
            arr.put(JSONObject().apply {
                put("id", d.id)
                put("name", d.name)
                put("room", d.room ?: JSONObject.NULL)
                put("connectivity", d.connectivity.wire)
                put("supported", d.supported)
                put("unsupportedReason", d.unsupportedReason ?: JSONObject.NULL)
                put("traits", JSONArray(d.traits))
                put("model", d.model ?: JSONObject.NULL)
                put("controls", JSONObject().apply {
                    put("power", d.controls.power); put("fanMode", d.controls.fanMode); put("fanPercent", d.controls.fanPercent)
                    put("fanSpeedLevel", d.controls.fanSpeedLevel); put("childLock", d.controls.childLock)
                })
                put("state", JSONObject().apply {
                    put("power", d.state.power ?: JSONObject.NULL)
                    put("fanMode", d.state.fanMode ?: JSONObject.NULL)
                    put("fanPercent", d.state.fanPercent ?: JSONObject.NULL)
                    put("fanModesAvailable", JSONArray().also { m ->
                        d.state.fanModesAvailable.forEach { m.put(JSONObject().put("id", it.id).put("label", it.label)) }
                    })
                    put("pm25", d.state.pm25 ?: JSONObject.NULL)
                    put("filterLifePercent", d.state.filterLifePercent ?: JSONObject.NULL)
                    put("fanSpeedLevel", d.state.fanSpeedLevel ?: JSONObject.NULL)
                    put("fanSpeedLevelsAvailable", JSONArray(d.state.fanSpeedLevelsAvailable))
                    put("childLockOn", d.state.childLockOn ?: JSONObject.NULL)
                })
                put("lastConfirmedAt", d.lastConfirmedAt ?: JSONObject.NULL)
            })
        }
    })
}.toString()

fun CommandOutcome.toJson(): String = JSONObject().apply {
    put("accepted", accepted); put("confirmed", confirmed); put("error", error ?: JSONObject.NULL)
}.toString()
