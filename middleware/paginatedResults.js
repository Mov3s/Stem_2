const paginatedResults = (model) => {
    return (req, res, next) => {

        var range
        if (req.query.range){
            range = JSON.parse(req.query.range)  //array, length = 2
        }else{
            next();
        }

        const startIndex = parseInt(range[0])
        const endIndex = parseInt(range[1])

        const result = {}

        if (endIndex < model.length){
            result.next = {
                page : page + 1,
                limit : range[1]
            }
        }

        if (startIndex > 0){
            result.previous = {
                page: page - 1,
                limit: range[1]
            }
        }

        result.results = model.slice(startIndex, endIndex)

        res.paginatedResults = result

    }
}

module.exports = paginatedResults;