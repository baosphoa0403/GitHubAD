using DatabaseContextLibary;
using Microsoft.Azure.EventHubs;
using Microsoft.Azure.WebJobs;
using Microsoft.Extensions.Logging;
using MiniProject.Entities;
using MiniProject.Function.Common;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static MiniProject.Function.Models.DataWorkLog;

namespace MiniProject.Function {
    public static class WorkLogFunction {
        [FunctionName("WorkLogFunction")]
        public static async Task Run([EventHubTrigger("miniWorkLog", Connection = "miniWorkLog")]EventData[] events, ILogger log)
    {
        var exceptions = new List < Exception > ();

        foreach(EventData eventData in events)
        {
            try {
                string messageBody = Encoding.UTF8.GetString(eventData.Body.Array, eventData.Body.Offset, eventData.Body.Count);

                // Replace these two lines with your processing logic.
                log.LogInformation($"C# Event Hub trigger function processed a message: {messageBody}");
                //await Task.Yield();
                var myData = JsonConvert.DeserializeObject < DataReceive > (messageBody);
                //var alertRequest = JsonConvert.DeserializeObject<DataReceive>(messageBody);
                var context = new ValidationContext(myData);
                var results = new List < ValidationResult > ();
                var valid = Validator.TryValidateObject(myData, context, results, true);
                if (!valid) {
                    results.ForEach(e => exceptions.Add(new AggregateException("<WorkLog> " + e.ErrorMessage)));
                }
                foreach(var data in myData.data)
                {
                    var context2 = new ValidationContext(data);
                    var results2 = new List < ValidationResult > ();
                    if (!Validator.TryValidateObject(data, context2, results2, true)) {
                        results2.ForEach(e => exceptions.Add(new AggregateException("<WorkLog> " + e.ErrorMessage)));
                    }

                }
                //if (!WorkLogValidation.IsValid(myData).Valid)
                //{
                // var a = WorkLogValidation.IsValid(myData).ListResult.Select(a => a.ErrorMessage).ToList();
                // //var b = WorkLogValidation.IsValid(myData.data).ListResult.Select(b => b.ErrorMessage).ToList();
                // a.ForEach(e => exceptions.Add(new AggregateException("<Alert> " + e)));
                // //b.ForEach(e => exceptions.Add(new AggregateException("<Alert> " + e)));
                //}
                /*var regex = new Regex("^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$");
                if (!regex.IsMatch(myData.userId))
                {
                exceptions.Add(new AggregateException("<Alert> " + myData.userId + " invalid"));
                }*/
                log.LogInformation("Device ID: " + myData.deviceId);
                log.LogInformation("User ID: " + myData.userId);

                foreach(var data in myData.data)
                {
                    //2020-05-15T 15:20:32+09:00
                    log.LogInformation("Date: " + data.date.ToString("yyyy-MM-ddT HH:mm:ssK"));
                    log.LogInformation("\tPresence: " + data.presence);
                }

                if (WorkLogValidation.IsValid(myData).Valid && exceptions.Count == 0) {
                    foreach(var data in myData.data)
                    {
                        using(var dbcontext = new ModelProject())
                            {
                                WorkingLog workingLogData = new WorkingLog
{
                            UserId = myData.userId,
                                DeviceId = myData.deviceId,
                                Date = data.date,
                                Presence = data.presence
                        };
                        dbcontext.workingLog.Add(workingLogData);
                        log.LogInformation("Add success before await!");
                        await dbcontext.SaveChangesAsync();
                        log.LogInformation("Add success!");

                    }
                    log.LogInformation("Check Add");
                }
            }
else
            {
                log.LogInformation("Add failed!");
            }
        }
catch (Exception e)
        {
            // We need to keep processing the rest of the batch - capture this exception and continue.
            // Also, consider capturing details of the message that failed processing so it can be processed again later.
            exceptions.Add(e);
        }
    }

    // Once processing of the batch is complete, if any messages in the batch failed processing throw an exception so that there is a record of the failure.

    if (exceptions.Count > 1)
        throw new AggregateException(exceptions);

    if (exceptions.Count == 1)
        throw exceptions.Single();
}
}
}