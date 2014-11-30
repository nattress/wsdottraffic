
exports.getPlotlyLayout = function(graphName)
{
    return {
        margin:{},
        xaxis:{
            type:"date",
            range:[
                1417116300000,
                1417198200000
            ],
            domain:[],
            autorange:true,
            tickfont:{
            color:"#444",
            family:"Open sans, verdana, arial, sans-serif",
            size:12
            },
            tickcolor:"rgba(0, 0, 0, 0)",
            zerolinewidth:1,
            ticklen:6,
            gridwidth:1,
            showgrid:true,
            titlefont:{
            color:"#444",
            family:"Open sans, verdana, arial, sans-serif",
            size:14
            },
            linecolor:"rgba(152, 0, 0, 0.5)",
            mirror:false,
            zeroline:true,
            showline:false,
            gridcolor:"#eee",
            linewidth:1.5,
            nticks:0,
            rangemode:"normal",
            autotick:true,
            tick0:0,
            dtick:1,
            ticks:"",
            showticklabels:true,
            tickangle:"auto",
            zerolinecolor:"#444",
            title:"Date / Time"
        },
        yaxis:{
            type:"linear",
            range:[
            25.666666666666668,
            52.333333333333336
            ],
            domain:[],
            autorange:true,
            tickfont:{
            color:"#444",
            family:"Open sans, verdana, arial, sans-serif",
            size:12
            },
            tickcolor:"rgba(0, 0, 0, 0)",
            zerolinewidth:1,
            ticklen:6,
            gridwidth:1,
            showgrid:true,
            titlefont:{
            color:"#444",
            family:"Open sans, verdana, arial, sans-serif",
            size:14
            },
            linecolor:"rgba(152, 0, 0, 0.5)",
            mirror:false,
            zeroline:true,
            showline:false,
            gridcolor:"#eee",
            linewidth:1.5,
            nticks:0,
            rangemode:"normal",
            autotick:true,
            tick0:0,
            dtick:1,
            ticks:"",
            showticklabels:true,
            tickangle:"auto",
            showexponent:"all",
            exponentformat:"B",
            zerolinecolor:"#444",
            title:"Travel Time (minutes)"
        },
        height:930,
        width:1367,
        autosize:true,
        showlegend:false,
        paper_bgcolor:"#fff",
        font:{
            family:"Open sans, verdana, arial, sans-serif",
            size:12,
            color:"#444"
        },
        legend:{
            bordercolor:"rgb(207, 206, 202)",
            bgcolor:"rgb(224, 221, 220)",
            borderwidth:0,
            xref:"paper",
            yref:"paper",
            y:0.5,
            x:1,
            font:{
                color:"rgb(105, 100, 124)"
            }
        },
            bargap:0.2,
            titlefont:{
            color:"#444",
            family:"Open sans, verdana, arial, sans-serif",
            size:17
        },
        plot_bgcolor:"#fff",
        separators:".,",
        hidesources:false,
        dragmode:"zoom",
        hovermode:"x",
        title: graphName
    }
}